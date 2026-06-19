CREATE OR REPLACE FUNCTION public.calculate_real_employee_profit_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_item record;
  v_employee_id uuid;
  v_delivery_fee numeric := 0;
  v_final_amount numeric := 0;
  v_eligible_items_total numeric := 0;
  v_items_with_rules_total numeric := 0;
  v_items_without_rules_total numeric := 0;
  v_real_discount numeric := 0;
  v_real_increase numeric := 0;
  v_discount_for_rules numeric := 0;
  v_increase_for_rules numeric := 0;
  v_employee_profit numeric := 0;
  v_total_cost numeric := 0;
  v_item_cost numeric := 0;
  v_item_price numeric := 0;
  v_eligible_qty integer := 0;
  v_item_profit numeric := 0;
  v_item_percentage numeric := 0;
  v_item_has_rule boolean := false;
  v_has_rule boolean := false;
  v_is_partial boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  v_employee_id := v_order.created_by;
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('exists', true, 'employee_id', NULL,
      'employee_profit', 0, 'total_revenue', 0, 'total_cost', 0, 'profit_amount', 0);
  END IF;

  v_final_amount := COALESCE(v_order.final_amount, v_order.total_amount, 0);
  v_delivery_fee := COALESCE(v_order.delivery_fee, 0);
  v_is_partial   := (v_order.order_type = 'partial_delivery')
                 OR (v_order.delivery_status IN ('17'));

  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price,
           oi.item_status, oi.quantity_delivered
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
  LOOP
    IF v_is_partial THEN
      v_eligible_qty := COALESCE(v_item.quantity_delivered, 0);
      IF v_eligible_qty <= 0 AND v_item.item_status = 'delivered' THEN
        v_eligible_qty := COALESCE(v_item.quantity, 0);
      END IF;
    ELSE
      v_eligible_qty := COALESCE(v_item.quantity, 0);
    END IF;
    IF v_eligible_qty <= 0 THEN CONTINUE; END IF;

    v_item_price := COALESCE(v_item.unit_price, 0) * v_eligible_qty;
    v_eligible_items_total := v_eligible_items_total + v_item_price;

    SELECT EXISTS(
      SELECT 1 FROM public.employee_profit_rules er
      WHERE er.employee_id = v_employee_id
        AND er.is_active = true
        AND (
          (er.rule_type = 'product' AND er.target_id = v_item.product_id::text)
          OR (er.rule_type = 'variant' AND er.target_id = v_item.variant_id::text)
        )
        AND er.created_at <= v_order.created_at
    ) INTO v_item_has_rule;

    IF v_item_has_rule THEN
      v_has_rule := true;
      v_items_with_rules_total := v_items_with_rules_total + v_item_price;
    ELSE
      v_items_without_rules_total := v_items_without_rules_total + v_item_price;
    END IF;
  END LOOP;

  -- Discount: items - final (no delivery in formula); Increase: final - items - delivery
  IF v_eligible_items_total > 0 THEN
    v_real_discount := GREATEST(0, v_eligible_items_total - v_final_amount);
    v_real_increase := GREATEST(0, v_final_amount - v_eligible_items_total - v_delivery_fee);
  END IF;

  IF v_has_rule AND (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
    v_discount_for_rules := v_real_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    v_increase_for_rules := v_real_increase * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price,
           oi.item_status, oi.quantity_delivered
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
  LOOP
    IF v_is_partial THEN
      v_eligible_qty := COALESCE(v_item.quantity_delivered, 0);
      IF v_eligible_qty <= 0 AND v_item.item_status = 'delivered' THEN
        v_eligible_qty := COALESCE(v_item.quantity, 0);
      END IF;
    ELSE
      v_eligible_qty := COALESCE(v_item.quantity, 0);
    END IF;
    IF v_eligible_qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(pv.cost_price, p.cost_price, 0) INTO v_item_cost
    FROM public.products p
    LEFT JOIN public.product_variants pv ON pv.id = v_item.variant_id
    WHERE p.id = v_item.product_id;

    v_total_cost := v_total_cost + (COALESCE(v_item_cost,0) * v_eligible_qty);

    SELECT er.profit_amount, er.profit_percentage INTO v_item_profit, v_item_percentage
    FROM public.employee_profit_rules er
    WHERE er.employee_id = v_employee_id
      AND er.is_active = true
      AND (
        (er.rule_type = 'variant' AND er.target_id = v_item.variant_id::text)
        OR (er.rule_type = 'product' AND er.target_id = v_item.product_id::text)
      )
      AND er.created_at <= v_order.created_at
    ORDER BY CASE er.rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END,
             er.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF COALESCE(v_item_percentage, 0) = 100 THEN
        v_employee_profit := v_employee_profit
          + GREATEST(0, (COALESCE(v_item.unit_price,0) - COALESCE(v_item_cost,0)) * v_eligible_qty);
      ELSE
        v_employee_profit := v_employee_profit + (COALESCE(v_item_profit,0) * v_eligible_qty);
      END IF;
    END IF;
    v_item_profit := 0; v_item_percentage := 0;
  END LOOP;

  IF v_has_rule THEN
    v_employee_profit := v_employee_profit + v_increase_for_rules - v_discount_for_rules;
  ELSE
    v_employee_profit := 0;
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'employee_id', v_employee_id,
    'employee_profit', v_employee_profit,
    'total_revenue', v_final_amount,
    'total_cost', v_total_cost,
    'profit_amount', (v_final_amount - v_delivery_fee) - v_total_cost,
    'real_discount', v_real_discount,
    'real_increase', v_real_increase,
    'has_rule', v_has_rule,
    'is_partial', v_is_partial
  );
END;
$function$;

DO $$
DECLARE r record; s record; v_new_profit numeric;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id AS order_id
    FROM public.delivery_invoices di
    JOIN public.delivery_invoice_orders dio ON dio.invoice_id = di.id
    JOIN public.orders o ON o.id = dio.order_id
    WHERE di.external_id = '3544160'
    UNION SELECT id FROM public.orders WHERE tracking_number = '148229025'
  LOOP
    v_new_profit := public.recompute_order_employee_profit(r.order_id, true);
    UPDATE public.settlement_invoice_orders sio
    SET amount = COALESCE(v_new_profit, 0), updated_at = now()
    WHERE sio.order_id = r.order_id;
  END LOOP;
  FOR s IN
    SELECT DISTINCT si.id
    FROM public.settlement_invoices si
    JOIN public.settlement_invoice_orders sio ON sio.settlement_invoice_id = si.id
    WHERE sio.order_id IN (
      SELECT DISTINCT dio.order_id FROM public.delivery_invoices di JOIN public.delivery_invoice_orders dio ON dio.invoice_id = di.id WHERE di.external_id = '3544160'
    )
  LOOP
    UPDATE public.settlement_invoices si
    SET total_amount = COALESCE((SELECT SUM(sio.amount) FROM public.settlement_invoice_orders sio WHERE sio.settlement_invoice_id = s.id), si.total_amount),
        updated_at = now()
    WHERE si.id = s.id;
  END LOOP;
END $$;