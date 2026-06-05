
-- RPC: تقرير أرباح الفواتير — security definer لتجاوز RLS مع تحقق ملكية الفواتير
CREATE OR REPLACE FUNCTION public.get_invoice_profits_report(p_invoice_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := is_admin_or_deputy();
  v_orders jsonb;
  v_items jsonb;
  v_profits jsonb;
  v_rules jsonb;
  v_names jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- التحقق: المستخدم يملك جميع الفواتير أو هو مدير عام
  IF NOT v_is_admin THEN
    IF EXISTS (
      SELECT 1 FROM delivery_invoices di
      WHERE di.id = ANY(p_invoice_ids) AND di.owner_user_id IS DISTINCT FROM v_caller
    ) THEN
      RAISE EXCEPTION 'not_owner';
    END IF;
  END IF;

  -- الطلبات المرتبطة بالفواتير المختارة
  WITH order_ids AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
  )
  SELECT jsonb_agg(to_jsonb(o)) INTO v_orders
  FROM (
    SELECT o.id, o.created_by, o.final_amount, o.total_amount, o.delivery_fee, o.order_type, o.is_exchange
    FROM orders o WHERE o.id IN (SELECT order_id FROM order_ids)
  ) o;

  SELECT jsonb_agg(jsonb_build_object(
    'order_id', oi.order_id,
    'product_id', oi.product_id,
    'variant_id', oi.variant_id,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price,
    'total_price', oi.total_price,
    'products', jsonb_build_object('id', p.id, 'name', p.name, 'owner_user_id', p.owner_user_id, 'cost_price', p.cost_price),
    'product_variants', CASE WHEN pv.id IS NULL THEN NULL ELSE jsonb_build_object('id', pv.id, 'cost_price', pv.cost_price) END
  )) INTO v_items
  FROM order_items oi
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN product_variants pv ON pv.id = oi.variant_id
  WHERE oi.order_id IN (
    SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
  );

  SELECT jsonb_agg(to_jsonb(pr)) INTO v_profits
  FROM (
    SELECT order_id, employee_id, employee_profit, profit_amount, total_revenue, total_cost, status
    FROM profits
    WHERE order_id IN (
      SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    )
  ) pr;

  SELECT jsonb_agg(DISTINCT er.employee_id) INTO v_rules
  FROM employee_profit_rules er
  WHERE er.is_active = true
    AND er.employee_id IN (
      SELECT DISTINCT o.created_by FROM orders o
      WHERE o.id IN (
        SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
        WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
      ) AND o.created_by IS NOT NULL
    );

  SELECT jsonb_object_agg(p.user_id, COALESCE(p.full_name, p.username, '')) INTO v_names
  FROM profiles p
  WHERE p.user_id IN (
    SELECT DISTINCT o.created_by FROM orders o
    WHERE o.id IN (
      SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    ) AND o.created_by IS NOT NULL
    UNION
    SELECT DISTINCT p2.owner_user_id FROM order_items oi JOIN products p2 ON p2.id=oi.product_id
    WHERE oi.order_id IN (
      SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    ) AND p2.owner_user_id IS NOT NULL
  );

  RETURN jsonb_build_object(
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'orderItems', COALESCE(v_items, '[]'::jsonb),
    'profits', COALESCE(v_profits, '[]'::jsonb),
    'employeesWithRules', COALESCE(v_rules, '[]'::jsonb),
    'namesMap', COALESCE(v_names, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_profits_report(uuid[]) TO authenticated;
