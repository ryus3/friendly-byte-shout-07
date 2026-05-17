-- 1) Replace link function with safer multi-phase matching
CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
RETURNS TABLE(fixed_count integer, linked_count integer, receipt_propagated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_linked_count INTEGER := 0;
  v_phase2_count INTEGER := 0;
  v_receipt_count INTEGER := 0;
BEGIN
  -- Phase 1: STRICT matching by definitive delivery IDs (tracking/qr/partner_order_id).
  UPDATE public.delivery_invoice_orders dio
  SET order_id = o.id, updated_at = now()
  FROM public.delivery_invoices di,
       public.orders o
  WHERE dio.invoice_id = di.id
    AND (
      o.tracking_number = COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
      OR o.delivery_partner_order_id = COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
      OR o.qr_id = COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
    )
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND (dio.order_id IS NULL OR dio.order_id <> o.id)
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14')
    AND NOT EXISTS (
      SELECT 1 FROM public.delivery_invoice_orders od
      WHERE od.order_id = o.id AND od.id <> dio.id
    );
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  -- Phase 2: SAFE fallback by phone + price when ID match failed.
  --   Only when EXACTLY ONE local order candidate matches phone+price within a safe window.
  WITH unmatched AS (
    SELECT dio.id AS dio_id,
           di.id AS inv_id,
           di.partner,
           right(regexp_replace(coalesce(dio.raw->>'client_mobile',''),'\D','','g'),10) AS api_phone,
           coalesce(NULLIF(dio.raw->>'price','')::numeric, dio.amount, 0) AS api_price,
           coalesce(di.received_at, di.issued_at, di.updated_at, now()) AS inv_date
    FROM public.delivery_invoice_orders dio
    JOIN public.delivery_invoices di ON di.id = dio.invoice_id
    WHERE dio.order_id IS NULL
      AND NULLIF(trim(dio.raw->>'client_mobile'), '') IS NOT NULL
  ),
  candidates AS (
    SELECT u.dio_id, u.inv_id, o.id AS order_id,
           row_number() OVER (PARTITION BY u.dio_id ORDER BY abs(coalesce(o.final_amount,0) - u.api_price) ASC, o.created_at DESC) AS rn,
           count(*) OVER (PARTITION BY u.dio_id) AS cnt
    FROM unmatched u
    JOIN public.orders o
      ON COALESCE(o.delivery_partner, u.partner) = u.partner
     AND right(regexp_replace(coalesce(o.customer_phone,''),'\D','','g'),10) = u.api_phone
     AND abs(coalesce(o.final_amount,0) - u.api_price) <= 10000
     AND o.created_at >= u.inv_date - interval '120 days'
     AND o.created_at <= u.inv_date + interval '14 days'
     AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
     AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14')
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_invoice_orders od WHERE od.order_id = o.id
     )
  ),
  unique_matches AS (
    SELECT dio_id, order_id FROM candidates WHERE cnt = 1 AND rn = 1
  )
  UPDATE public.delivery_invoice_orders dio
  SET order_id = um.order_id, updated_at = now()
  FROM unique_matches um
  WHERE dio.id = um.dio_id AND dio.order_id IS NULL;
  GET DIAGNOSTICS v_phase2_count = ROW_COUNT;
  v_linked_count := v_linked_count + v_phase2_count;

  -- Phase 3: propagate delivery_partner_invoice_id on linked orders
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id,
      delivery_partner_invoice_date = COALESCE(di.received_at, di.issued_at, di.updated_at),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
    AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14');
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  -- Phase 4: propagate receipt_received from received invoices
  UPDATE public.orders o
  SET receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, di.issued_at, now()),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND di.received = true
    AND (o.receipt_received IS DISTINCT FROM true)
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled');
  GET DIAGNOSTICS v_receipt_count = ROW_COUNT;

  RETURN QUERY SELECT v_fixed_count, v_linked_count, v_receipt_count;
END;
$function$;

-- 2) Update employee invoice view RPC to include shared-account invoices even when not linked yet
CREATE OR REPLACE FUNCTION public.get_employee_invoices_for_view(
  p_supervisor_id uuid DEFAULT NULL,
  p_is_admin boolean DEFAULT false,
  p_days_back integer DEFAULT 180,
  p_limit integer DEFAULT 500
)
RETURNS TABLE(
  invoice_id uuid,
  external_id text,
  partner text,
  partner_name_ar text,
  account_username text,
  amount numeric,
  orders_count integer,
  issued_at timestamptz,
  received boolean,
  received_at timestamptz,
  received_flag boolean,
  status text,
  status_normalized text,
  owner_user_id uuid,
  attributed_user_id uuid,
  employee_full_name text,
  employee_username text,
  employee_code text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_general_manager_id uuid := '91484496-b887-44f7-9e5d-be9db5567604';
  v_threshold timestamptz := now() - (p_days_back || ' days')::interval;
BEGIN
  RETURN QUERY
  WITH allowed_employees AS (
    SELECT pr.user_id, pr.full_name, pr.username, pr.employee_code
    FROM public.profiles pr
    WHERE pr.is_active = true
      AND pr.user_id <> v_general_manager_id
      AND (
        p_is_admin = true
        OR EXISTS (
          SELECT 1 FROM public.employee_supervisors es
          WHERE es.supervisor_id = p_supervisor_id
            AND es.employee_id = pr.user_id
            AND es.is_active = true
        )
      )
  ),
  recent_invoices AS (
    SELECT di.*
    FROM public.delivery_invoices di
    WHERE di.partner IN ('alwaseet','modon')
      AND COALESCE(di.issued_at, di.created_at) >= v_threshold
    ORDER BY COALESCE(di.issued_at, di.created_at) DESC
    LIMIT p_limit
  ),
  link_owners AS (
    SELECT DISTINCT di.id AS inv_id, o.created_by AS user_id
    FROM recent_invoices di
    JOIN public.orders o
      ON o.delivery_partner_invoice_id = di.external_id
    WHERE o.created_by IN (SELECT user_id FROM allowed_employees)
  ),
  account_owners AS (
    SELECT DISTINCT di.id AS inv_id, t.user_id
    FROM recent_invoices di
    JOIN public.delivery_partner_tokens t
      ON t.partner_name = di.partner
     AND lower(coalesce(t.normalized_username, t.account_username)) = lower(coalesce(di.account_username, ''))
    WHERE t.user_id IN (SELECT user_id FROM allowed_employees)
      AND di.account_username IS NOT NULL AND di.account_username <> ''
  ),
  direct_owners AS (
    SELECT di.id AS inv_id, di.owner_user_id AS user_id
    FROM recent_invoices di
    WHERE di.owner_user_id IN (SELECT user_id FROM allowed_employees)
  ),
  unioned AS (
    SELECT * FROM link_owners
    UNION
    SELECT * FROM account_owners
    UNION
    SELECT * FROM direct_owners
  )
  SELECT
    di.id,
    di.external_id,
    di.partner,
    di.partner_name_ar,
    di.account_username,
    di.amount,
    di.orders_count,
    di.issued_at,
    di.received,
    di.received_at,
    di.received_flag,
    di.status,
    di.status_normalized,
    di.owner_user_id,
    u.user_id AS attributed_user_id,
    ae.full_name,
    ae.username,
    ae.employee_code,
    di.created_at,
    di.updated_at
  FROM unioned u
  JOIN recent_invoices di ON di.id = u.inv_id
  JOIN allowed_employees ae ON ae.user_id = u.user_id
  ORDER BY di.issued_at DESC NULLS LAST, di.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_invoices_for_view(uuid, boolean, integer, integer) TO authenticated;

-- 3) Run linker once to heal current data
SELECT * FROM public.link_invoice_orders_to_orders();