-- Strictly scope invoice-order rows to the local order owner or their authorized supervisor/admin.
DROP POLICY IF EXISTS "invoice_orders_select_scoped" ON public.delivery_invoice_orders;

CREATE POLICY "invoice_orders_select_scoped"
ON public.delivery_invoice_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = delivery_invoice_orders.order_id
      AND (
        o.created_by = auth.uid()
        OR public.is_admin_or_deputy()
        OR EXISTS (
          SELECT 1
          FROM public.employee_supervisors es
          WHERE es.supervisor_id = auth.uid()
            AND es.employee_id = o.created_by
            AND es.is_active = true
        )
      )
  )
  OR (
    delivery_invoice_orders.order_id IS NULL
    AND delivery_invoice_orders.owner_user_id = auth.uid()
  )
);

-- Rebuild the employee invoice view so shared delivery accounts do not attribute invoice rows
-- by account ownership. A row appears for an employee only when that employee has local
-- orders actually linked to the invoice.
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
  linked_order_pairs AS (
    SELECT DISTINCT di.id AS inv_id, o.created_by AS user_id, o.id AS order_id
    FROM recent_invoices di
    JOIN public.delivery_invoice_orders dio
      ON dio.invoice_id = di.id
    JOIN public.orders o
      ON o.id = dio.order_id
    WHERE o.created_by IN (SELECT user_id FROM allowed_employees)

    UNION

    SELECT DISTINCT di.id AS inv_id, o.created_by AS user_id, o.id AS order_id
    FROM recent_invoices di
    JOIN public.orders o
      ON o.delivery_partner_invoice_id = di.external_id
     AND COALESCE(o.delivery_partner, di.partner) = di.partner
    WHERE o.created_by IN (SELECT user_id FROM allowed_employees)
  ),
  attributed AS (
    SELECT lop.inv_id, lop.user_id, count(*)::integer AS local_orders_count
    FROM linked_order_pairs lop
    GROUP BY lop.inv_id, lop.user_id
  )
  SELECT
    di.id,
    di.external_id,
    di.partner,
    di.partner_name_ar,
    di.account_username,
    di.amount,
    a.local_orders_count AS orders_count,
    di.issued_at,
    di.received,
    di.received_at,
    di.received_flag,
    di.status,
    di.status_normalized,
    di.owner_user_id,
    a.user_id AS attributed_user_id,
    ae.full_name,
    ae.username,
    ae.employee_code,
    di.created_at,
    di.updated_at
  FROM attributed a
  JOIN recent_invoices di ON di.id = a.inv_id
  JOIN allowed_employees ae ON ae.user_id = a.user_id
  ORDER BY di.issued_at DESC NULLS LAST, di.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_invoices_for_view(uuid, boolean, integer, integer) TO authenticated;