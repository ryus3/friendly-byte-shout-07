
-- Update calculator: only treat true returned orders as zero; for delivered/in-transit with discount,
-- compute real revenue (may be negative) and keep employee_profit clamped at 0.
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

  -- ✅ Only true returns: orders.status = 'returned' (we do NOT touch the returns system)
  v_is_returned := (v_order.status = 'returned');

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

  -- Real discount/increase based on items vs (final - delivery)
  IF v_eligible_items_total > 0 THEN
    v_real_discount := GREATEST(0, v_eligible_items_total - v_real_revenue);
    v_real_increase := GREATEST(0, v_real_revenue - v_eligible_items_total);
  END IF;

  IF v_has_rule AND (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
    v_discount_for_rules := v_real_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    v_increase_for_rules := v_real_increase * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
  END IF;

  -- Compute base employee profit + total cost
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

    v_total_cost := v_total_cost + (v_item_cost * v_eligible_qty);

    SELECT er.profit_amount, er.profit_percentage INTO v_item_profit, v_item_percentage
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

    IF v_item_profit IS NOT NULL THEN
      v_employee_base_profit := v_employee_base_profit + (v_item_profit * v_eligible_qty);
    ELSIF v_item_percentage IS NOT NULL THEN
      v_employee_base_profit := v_employee_base_profit + (COALESCE(v_item.unit_price,0) * v_eligible_qty * v_item_percentage / 100.0);
    END IF;

    v_item_profit := NULL; v_item_percentage := NULL;
  END LOOP;

  -- Employee profit: base + increase − discount, clamped >= 0 (employee never owes more than earned)
  v_employee_profit := GREATEST(0, v_employee_base_profit + v_increase_for_rules - v_discount_for_rules);

  RETURN jsonb_build_object(
    'exists', true,
    'employee_id', v_employee_id,
    'employee_profit', v_employee_profit,
    'employee_base_profit', v_employee_base_profit,
    -- Real revenue may be negative when discount > items_total (e.g., customer paid only delivery)
    'total_revenue', v_real_revenue,
    'total_cost', v_total_cost,
    -- Real owner/system profit (may be negative — do NOT hide losses)
    'profit_amount', v_real_revenue - v_total_cost,
    'real_discount', v_real_discount,
    'real_increase', v_real_increase,
    'is_returned', false,
    'is_partial', v_is_partial
  );
END;
$function$;

-- Self-heal order 148310689 with the corrected logic
DO $$
DECLARE v_oid uuid; v_res jsonb;
BEGIN
  SELECT id INTO v_oid FROM public.orders
    WHERE tracking_number::text='148310689' OR delivery_partner_order_id::text='148310689'
    LIMIT 1;
  IF v_oid IS NOT NULL THEN
    v_res := public.calculate_real_employee_profit_for_order(v_oid);
    UPDATE public.profits
       SET employee_profit = COALESCE((v_res->>'employee_profit')::numeric, 0),
           total_revenue   = COALESCE((v_res->>'total_revenue')::numeric, 0),
           total_cost      = COALESCE((v_res->>'total_cost')::numeric, 0),
           profit_amount   = COALESCE((v_res->>'profit_amount')::numeric, 0),
           updated_at      = now()
     WHERE order_id = v_oid;
  END IF;
END $$;
