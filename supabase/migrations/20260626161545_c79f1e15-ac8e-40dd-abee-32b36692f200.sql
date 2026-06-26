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
  v_employee_base_profit numeric := 0;
  v_total_cost numeric := 0;
  v_item_cost numeric := 0;
  v_item_price numeric := 0;
  v_eligible_qty integer := 0;
  v_item_profit numeric := 0;
  v_item_percentage numeric := 0;
  v_item_has_rule boolean := false;
  v_has_rule boolean := false;
  v_is_partial boolean := false;
  v_is_returned boolean := false;
  v_real_revenue numeric := 0;
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

  -- قاعدة صارمة: الإرجاع الحقيقي يُعرف من نوع الطلب فقط، وليس من delivery_status/status.
  v_is_returned := (COALESCE(v_order.order_type, 'regular') = 'return');

  IF v_is_returned THEN
    RETURN jsonb_build_object(
      'exists', true,
      'employee_id', v_employee_id,
      'employee_profit', 0,
      'total_revenue', 0,
      'total_cost', 0,
      'profit_amount', 0,
      'is_returned', true
    );
  END IF;

  v_final_amount := COALESCE(v_order.final_amount, v_order.total_amount, 0);
  v_delivery_fee := COALESCE(v_order.delivery_fee, 0);
  v_is_partial   := (v_order.order_type = 'partial_delivery');
  v_real_revenue := v_final_amount - v_delivery_fee;

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

  IF v_eligible_items_total > 0 THEN
    v_real_discount := GREATEST(0, v_eligible_items_total - v_real_revenue);
    v_real_increase := GREATEST(0, v_real_revenue - v_eligible_items_total);
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

    v_item_price := COALESCE(v_item.unit_price, 0) * v_eligible_qty;

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

    SELECT COALESCE(p.cost_price, pv.cost_price, 0)
      INTO v_item_cost
      FROM public.products p
      LEFT JOIN public.product_variants pv ON pv.id = v_item.variant_id
      WHERE p.id = v_item.product_id;

    v_total_cost := v_total_cost + (COALESCE(v_item_cost, 0) * v_eligible_qty);

    IF v_item_has_rule THEN
      SELECT COALESCE(er.profit_amount, 0), COALESCE(er.profit_percentage, 0)
        INTO v_item_profit, v_item_percentage
      FROM public.employee_profit_rules er
      WHERE er.employee_id = v_employee_id
        AND er.is_active = true
        AND (
          (er.rule_type = 'product' AND er.target_id = v_item.product_id::text)
          OR (er.rule_type = 'variant' AND er.target_id = v_item.variant_id::text)
        )
        AND er.created_at <= v_order.created_at
      ORDER BY er.created_at DESC
      LIMIT 1;

      IF v_item_profit > 0 THEN
        v_employee_base_profit := v_employee_base_profit + (v_item_profit * v_eligible_qty);
      ELSIF v_item_percentage > 0 THEN
        v_employee_base_profit := v_employee_base_profit + ((v_item_price - (COALESCE(v_item_cost, 0) * v_eligible_qty)) * v_item_percentage / 100);
      END IF;
    END IF;
  END LOOP;

  v_employee_profit := v_employee_base_profit - v_discount_for_rules + v_increase_for_rules;

  RETURN jsonb_build_object(
    'exists', true,
    'employee_id', v_employee_id,
    'employee_profit', GREATEST(0, v_employee_profit),
    'employee_base_profit', v_employee_base_profit,
    'total_revenue', v_eligible_items_total,
    'total_cost', v_total_cost,
    'profit_amount', v_eligible_items_total - v_total_cost,
    'real_revenue', v_real_revenue,
    'real_discount', v_real_discount,
    'real_increase', v_real_increase,
    'discount_for_rules', v_discount_for_rules,
    'increase_for_rules', v_increase_for_rules,
    'has_rule', v_has_rule,
    'is_returned', false
  );
END;
$function$;