
-- إعادة احتساب employee_profit للطلبات الحالية بحيث يساوي القاعدة + الزيادة - الخصم
-- نطبق فقط على الطلبات المسلَّمة (delivery_status='4') لتجنب اللمس بالطلبات غير المنتهية
DO $$
DECLARE
  r RECORD;
  v_emp uuid;
  v_emp_profit numeric;
  v_items_with_rules numeric;
  v_items_without_rules numeric;
  v_discount_for_rules numeric;
  v_increase_for_rules numeric;
  v_order_discount numeric;
  v_order_increase numeric;
  v_has_rule boolean;
  v_item RECORD;
  v_item_profit numeric;
  v_item_percentage numeric;
  v_item_cost numeric;
  v_item_price numeric;
BEGIN
  FOR r IN
    SELECT o.id, o.created_by, o.discount, o.price_increase, o.created_at, o.tracking_number, o.order_number, o.receipt_received
    FROM orders o
    JOIN profits p ON p.order_id = o.id
    WHERE o.delivery_status = '4'
      AND p.status NOT IN ('settled')
  LOOP
    v_emp := r.created_by;
    IF v_emp IS NULL THEN CONTINUE; END IF;
    v_emp_profit := 0;
    v_items_with_rules := 0;
    v_items_without_rules := 0;
    v_order_discount := COALESCE(r.discount, 0);
    v_order_increase := COALESCE(r.price_increase, 0);

    FOR v_item IN
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi WHERE oi.order_id = r.id
    LOOP
      v_item_price := COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity, 0);
      SELECT EXISTS(
        SELECT 1 FROM employee_profit_rules
        WHERE employee_id = v_emp AND is_active = true
          AND ((rule_type = 'product' AND target_id = v_item.product_id::text)
            OR (rule_type = 'variant' AND target_id = v_item.variant_id::text))
          AND created_at <= r.created_at
      ) INTO v_has_rule;
      IF v_has_rule THEN
        v_items_with_rules := v_items_with_rules + v_item_price;
      ELSE
        v_items_without_rules := v_items_without_rules + v_item_price;
      END IF;
    END LOOP;

    IF (v_items_with_rules + v_items_without_rules) > 0 THEN
      v_discount_for_rules := v_order_discount * (v_items_with_rules / (v_items_with_rules + v_items_without_rules));
      v_increase_for_rules := v_order_increase * (v_items_with_rules / (v_items_with_rules + v_items_without_rules));
    ELSE
      v_discount_for_rules := v_order_discount;
      v_increase_for_rules := v_order_increase;
    END IF;
    IF v_items_with_rules > 0 AND v_items_without_rules = 0 THEN
      v_discount_for_rules := v_order_discount;
      v_increase_for_rules := v_order_increase;
    END IF;

    FOR v_item IN
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi WHERE oi.order_id = r.id
    LOOP
      SELECT COALESCE(pv.cost_price, p.cost_price, 0) INTO v_item_cost
      FROM products p LEFT JOIN product_variants pv ON pv.id = v_item.variant_id
      WHERE p.id = v_item.product_id;

      SELECT profit_amount, profit_percentage INTO v_item_profit, v_item_percentage
      FROM employee_profit_rules
      WHERE employee_id = v_emp AND is_active = true
        AND ((rule_type = 'product' AND target_id = v_item.product_id::text)
          OR (rule_type = 'variant' AND target_id = v_item.variant_id::text))
        AND created_at <= r.created_at
      ORDER BY CASE rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END LIMIT 1;

      IF COALESCE(v_item_percentage, 0) = 100 THEN
        v_emp_profit := v_emp_profit + GREATEST(0, (COALESCE(v_item.unit_price, 0) - COALESCE(v_item_cost, 0)) * v_item.quantity);
      ELSE
        v_emp_profit := v_emp_profit + (COALESCE(v_item_profit, 0) * v_item.quantity);
      END IF;
    END LOOP;

    v_emp_profit := v_emp_profit + v_increase_for_rules - v_discount_for_rules;

    UPDATE profits SET 
      employee_profit = v_emp_profit,
      updated_at = NOW()
    WHERE order_id = r.id AND status NOT IN ('settled');
  END LOOP;
END $$;
