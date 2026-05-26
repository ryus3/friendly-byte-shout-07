-- إعادة الفواتير للمدير في صفحة متابعة الموظفين:
-- نُضيف fallback عبر حساب شركة التوصيل المشترك (توكنات نشطة)
-- إضافة إلى الطلبات المرتبطة محلياً والمالك المباشر.
-- هذا يُعيد سلوك ما قبل آخر تغيير: الفاتورة المشتركة تظهر لكل موظف لديه توكن نشط على نفس الحساب،
-- حتى لو لم تكن طلباته المحلية مرتبطة بعد.

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
  -- 1) أصحاب الفاتورة عبر روابط delivery_invoice_orders
  link_owners AS (
    SELECT DISTINCT di.id AS inv_id, o.created_by AS user_id, o.id AS order_id
    FROM recent_invoices di
    JOIN public.delivery_invoice_orders dio ON dio.invoice_id = di.id
    JOIN public.orders o ON o.id = dio.order_id
    WHERE o.created_by IN (SELECT user_id FROM allowed_employees)
  ),
  -- 2) أصحاب الفاتورة عبر orders.delivery_partner_invoice_id (حتى لو لم تُربط dio بعد)
  invoice_id_owners AS (
    SELECT DISTINCT di.id AS inv_id, o.created_by AS user_id, o.id AS order_id
    FROM recent_invoices di
    JOIN public.orders o
      ON o.delivery_partner_invoice_id = di.external_id
     AND COALESCE(o.delivery_partner, di.partner) = di.partner
    WHERE o.created_by IN (SELECT user_id FROM allowed_employees)
  ),
  -- 3) Fallback: حساب شركة توصيل مشترك — كل موظف مسموح لديه توكن نشط لنفس الحساب
  account_owners AS (
    SELECT DISTINCT di.id AS inv_id, t.user_id, NULL::uuid AS order_id
    FROM recent_invoices di
    JOIN public.delivery_partner_tokens t
      ON t.partner_name = di.partner
     AND lower(coalesce(t.normalized_username, t.account_username)) = lower(coalesce(di.account_username, ''))
     AND t.is_active = true
    WHERE t.user_id IN (SELECT user_id FROM allowed_employees)
      AND di.account_username IS NOT NULL AND di.account_username <> ''
  ),
  -- 4) المالك المباشر للفاتورة إذا كان موظفاً مسموحاً
  direct_owners AS (
    SELECT DISTINCT di.id AS inv_id, di.owner_user_id AS user_id, NULL::uuid AS order_id
    FROM recent_invoices di
    WHERE di.owner_user_id IN (SELECT user_id FROM allowed_employees)
  ),
  unioned AS (
    SELECT inv_id, user_id, order_id FROM link_owners
    UNION
    SELECT inv_id, user_id, order_id FROM invoice_id_owners
    UNION
    SELECT inv_id, user_id, order_id FROM account_owners
    UNION
    SELECT inv_id, user_id, order_id FROM direct_owners
  ),
  attributed AS (
    SELECT u.inv_id, u.user_id, count(u.order_id)::integer AS local_orders_count
    FROM unioned u
    GROUP BY u.inv_id, u.user_id
  )
  SELECT
    di.id,
    di.external_id,
    di.partner,
    di.partner_name_ar,
    di.account_username,
    di.amount,
    COALESCE(NULLIF(a.local_orders_count, 0), di.orders_count) AS orders_count,
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