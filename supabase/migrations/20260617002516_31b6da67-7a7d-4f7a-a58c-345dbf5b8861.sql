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
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_employee_profit numeric := 0;
  v_profit_amount numeric := 0;
  v_item_profit numeric := 0;
  v_item_percentage numeric := 0;
  v_item_cost numeric := 0;
  v_item_price numeric := 0;
  v_items_with_rules_total numeric := 0;
  v_items_without_rules_total numeric := 0;
  v_discount_for_rules numeric := 0;
  v_increase_for_rules numeric := 0;
  v_order_discount numeric := 0;
  v_order_increase numeric := 0;
  v_has_rule boolean := false;
  v_item_has_rule boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  v_employee_id := v_order.created_by;
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('exists', true, 'employee_id', NULL, 'employee_profit', 0, 'total_revenue', 0, 'total_cost', 0, 'profit_amount', 0);
  END IF;

  v_total_revenue := COALESCE(v_order.final_amount, v_order.total_amount, 0);
  v_order_discount := COALESCE(v_order.discount, 0);
  v_order_increase := COALESCE(v_order.price_increase, 0);

  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
  LOOP
    v_item_price := COALESCE(v_item.total_price, COALESCE(v_item.unit_price, 0) * COALESCE(v_item.quantity, 0), 0);

    SELECT EXISTS(
      SELECT 1
      FROM public.employee_profit_rules er
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

  IF (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
    IF v_has_rule THEN
      v_discount_for_rules := v_order_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_increase_for_rules := v_order_increase * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    ELSE
      v_discount_for_rules := 0;
      v_increase_for_rules := 0;
    END IF;
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
  LOOP
    SELECT COALESCE(pv.cost_price, p.cost_price, 0)
    INTO v_item_cost
    FROM public.products p
    LEFT JOIN public.product_variants pv ON pv.id = v_item.variant_id
    WHERE p.id = v_item.product_id;

    v_total_cost := v_total_cost + (COALESCE(v_item_cost, 0) * COALESCE(v_item.quantity, 0));

    SELECT er.profit_amount, er.profit_percentage
    INTO v_item_profit, v_item_percentage
    FROM public.employee_profit_rules er
    WHERE er.employee_id = v_employee_id
      AND er.is_active = true
      AND (
        (er.rule_type = 'variant' AND er.target_id = v_item.variant_id::text)
        OR (er.rule_type = 'product' AND er.target_id = v_item.product_id::text)
      )
      AND er.created_at <= v_order.created_at
    ORDER BY CASE er.rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END, er.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF COALESCE(v_item_percentage, 0) = 100 THEN
        v_employee_profit := v_employee_profit + GREATEST(0, (COALESCE(v_item.unit_price, 0) - COALESCE(v_item_cost, 0)) * COALESCE(v_item.quantity, 0));
      ELSE
        v_employee_profit := v_employee_profit + (COALESCE(v_item_profit, 0) * COALESCE(v_item.quantity, 0));
      END IF;
    END IF;

    v_item_profit := 0;
    v_item_percentage := 0;
  END LOOP;

  IF v_has_rule THEN
    v_employee_profit := v_employee_profit + v_increase_for_rules - v_discount_for_rules;
  ELSE
    v_employee_profit := 0;
  END IF;

  v_profit_amount := v_total_revenue - v_total_cost;

  RETURN jsonb_build_object(
    'exists', true,
    'employee_id', v_employee_id,
    'employee_profit', v_employee_profit,
    'total_revenue', v_total_revenue,
    'total_cost', v_total_cost,
    'profit_amount', v_profit_amount,
    'discount_for_rules', v_discount_for_rules,
    'increase_for_rules', v_increase_for_rules,
    'has_rule', v_has_rule
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_real_employee_profit_for_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_real_employee_profit_for_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_order_employee_profit(p_order_id uuid, p_force_settled boolean DEFAULT false)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_calc jsonb;
  v_employee_profit numeric := 0;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_profit_amount numeric := 0;
BEGIN
  v_calc := public.calculate_real_employee_profit_for_order(p_order_id);
  IF COALESCE((v_calc->>'exists')::boolean, false) = false THEN
    RETURN NULL;
  END IF;

  v_employee_profit := COALESCE((v_calc->>'employee_profit')::numeric, 0);
  v_total_revenue := COALESCE((v_calc->>'total_revenue')::numeric, 0);
  v_total_cost := COALESCE((v_calc->>'total_cost')::numeric, 0);
  v_profit_amount := COALESCE((v_calc->>'profit_amount')::numeric, 0);

  UPDATE public.profits
  SET employee_profit = v_employee_profit,
      total_revenue = v_total_revenue,
      total_cost = v_total_cost,
      profit_amount = v_profit_amount,
      updated_at = now()
  WHERE order_id = p_order_id
    AND (p_force_settled = true OR status != 'settled');

  RETURN v_employee_profit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recompute_order_employee_profit(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_order_employee_profit(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_order_employee_profit(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.recompute_order_employee_profit(p_order_id, false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recompute_order_employee_profit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_order_employee_profit(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_calc jsonb;
  v_employee_id uuid;
  v_employee_profit numeric := 0;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_profit_amount numeric := 0;
  v_has_rule boolean := false;
  v_final_status text;
BEGIN
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    v_calc := public.calculate_real_employee_profit_for_order(NEW.id);
    v_employee_id := (v_calc->>'employee_id')::uuid;
    IF v_employee_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_employee_profit := COALESCE((v_calc->>'employee_profit')::numeric, 0);
    v_total_revenue := COALESCE((v_calc->>'total_revenue')::numeric, 0);
    v_total_cost := COALESCE((v_calc->>'total_cost')::numeric, 0);
    v_profit_amount := COALESCE((v_calc->>'profit_amount')::numeric, 0);
    v_has_rule := COALESCE((v_calc->>'has_rule')::boolean, false);

    IF NOT v_has_rule AND COALESCE(NEW.discount, 0) = 0 AND COALESCE(NEW.price_increase, 0) = 0 THEN
      v_final_status := 'no_rule_archived';
    ELSIF NEW.receipt_received THEN
      v_final_status := 'invoice_received';
    ELSE
      v_final_status := 'pending';
    END IF;

    INSERT INTO public.profits (
      employee_id, order_id, total_revenue, total_cost, profit_amount,
      employee_percentage, employee_profit, status, settled_at, created_at, updated_at
    ) VALUES (
      v_employee_id, NEW.id, v_total_revenue, v_total_cost, v_profit_amount,
      0, v_employee_profit, v_final_status,
      CASE WHEN v_final_status = 'no_rule_archived' THEN now() ELSE NULL END, now(), now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = CASE
        WHEN profits.status = 'settled' THEN profits.status
        WHEN EXCLUDED.status = 'no_rule_archived' THEN 'no_rule_archived'
        WHEN NEW.receipt_received THEN 'invoice_received'
        ELSE profits.status
      END,
      settled_at = CASE
        WHEN profits.status = 'settled' THEN profits.settled_at
        WHEN EXCLUDED.status = 'no_rule_archived' THEN now()
        ELSE profits.settled_at
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.repair_delivery_invoice_employee_profits(p_external_id text, p_partner text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  s record;
  v_new_profit numeric;
  v_affected_orders int := 0;
  v_affected_settlements int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id AS order_id
    FROM public.delivery_invoices di
    JOIN public.delivery_invoice_orders dio ON dio.invoice_id = di.id
    JOIN public.orders o ON o.id = dio.order_id
    WHERE di.external_id = p_external_id
      AND (p_partner IS NULL OR di.partner = p_partner)
  LOOP
    v_new_profit := public.recompute_order_employee_profit(r.order_id, true);
    v_affected_orders := v_affected_orders + 1;

    UPDATE public.settlement_invoice_orders sio
    SET amount = COALESCE(v_new_profit, 0),
        updated_at = now()
    WHERE sio.order_id = r.order_id;
  END LOOP;

  FOR s IN
    SELECT DISTINCT si.id
    FROM public.settlement_invoices si
    JOIN public.settlement_invoice_orders sio ON sio.settlement_invoice_id = si.id
    JOIN public.orders o ON o.id = sio.order_id
    WHERE o.id IN (
      SELECT DISTINCT dio.order_id
      FROM public.delivery_invoices di
      JOIN public.delivery_invoice_orders dio ON dio.invoice_id = di.id
      WHERE di.external_id = p_external_id
        AND (p_partner IS NULL OR di.partner = p_partner)
    )
  LOOP
    UPDATE public.settlement_invoices si
    SET total_amount = COALESCE((SELECT SUM(sio.amount) FROM public.settlement_invoice_orders sio WHERE sio.settlement_invoice_id = s.id), 0),
        order_ids = COALESCE((SELECT array_agg(sio.order_id) FROM public.settlement_invoice_orders sio WHERE sio.settlement_invoice_id = s.id), ARRAY[]::uuid[]),
        profit_ids = COALESCE((SELECT array_agg(sio.profit_id) FROM public.settlement_invoice_orders sio WHERE sio.settlement_invoice_id = s.id), ARRAY[]::uuid[]),
        updated_at = now()
    WHERE si.id = s.id;
    v_affected_settlements := v_affected_settlements + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'external_id', p_external_id,
    'partner', p_partner,
    'affected_orders', v_affected_orders,
    'affected_settlements', v_affected_settlements
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_delivery_invoice_employee_profits(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_delivery_invoice_employee_profits(text, text) TO service_role;