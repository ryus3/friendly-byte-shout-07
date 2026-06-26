
CREATE OR REPLACE FUNCTION public.get_invoice_profits_report(p_invoice_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := is_admin_or_deputy();
  v_orders jsonb;
  v_items jsonb;
  v_profits jsonb;
  v_rules jsonb;
  v_names jsonb;
  v_allowed_count int;
  v_total_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_total_count FROM delivery_invoices WHERE id = ANY(p_invoice_ids);
    SELECT COUNT(*) INTO v_allowed_count
    FROM delivery_invoices di
    WHERE di.id = ANY(p_invoice_ids)
      AND (
        di.owner_user_id = v_caller
        OR EXISTS (SELECT 1 FROM employee_supervisors es
          WHERE es.supervisor_id = v_caller AND es.is_active = true AND es.employee_id = di.owner_user_id)
        OR EXISTS (SELECT 1 FROM delivery_invoice_orders dio JOIN orders o ON o.id = dio.order_id
          WHERE dio.invoice_id = di.id AND o.created_by = v_caller)
        OR EXISTS (SELECT 1 FROM delivery_invoice_orders dio JOIN orders o ON o.id = dio.order_id
          JOIN employee_supervisors es ON es.employee_id = o.created_by
          WHERE dio.invoice_id = di.id AND es.supervisor_id = v_caller AND es.is_active = true)
        OR EXISTS (SELECT 1 FROM delivery_invoice_orders dio JOIN order_items oi ON oi.order_id = dio.order_id
          JOIN products p ON p.id = oi.product_id WHERE dio.invoice_id = di.id AND p.owner_user_id = v_caller)
      );
    IF v_allowed_count <> v_total_count THEN
      RAISE EXCEPTION 'not_owner';
    END IF;
  END IF;

  WITH order_ids AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
  ),
  dio_amounts AS (
    SELECT dio.order_id, SUM(COALESCE(dio.amount, 0)) AS amount
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    GROUP BY dio.order_id
  )
  SELECT jsonb_agg(to_jsonb(o)) INTO v_orders
  FROM (
    SELECT o.id, o.created_by, o.final_amount, o.total_amount, o.delivery_fee,
           o.order_type, o.status, o.delivery_status,
           da.amount AS invoice_order_amount
    FROM orders o
    LEFT JOIN dio_amounts da ON da.order_id = o.id
    WHERE o.id IN (SELECT order_id FROM order_ids)
  ) o;

  SELECT jsonb_agg(jsonb_build_object(
    'order_id', oi.order_id,
    'product_id', oi.product_id,
    'variant_id', oi.variant_id,
    'quantity', oi.quantity,
    'quantity_delivered', oi.quantity_delivered,
    'quantity_returned', oi.quantity_returned,
    'item_status', oi.item_status,
    'item_direction', oi.item_direction,
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
$function$;
