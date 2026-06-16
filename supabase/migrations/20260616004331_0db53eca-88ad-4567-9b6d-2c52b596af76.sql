
-- =============================================================
-- Migration: تصحيح الأرباح الحقيقية + back-fill شامل
-- =============================================================

-- 1) دالة مساعدة لإعادة حساب employee_profit لطلب محدد
--    تطابق منطق trigger auto_create_profit_record بالضبط (قاعدة + زيادة - خصم)
CREATE OR REPLACE FUNCTION public.recompute_order_employee_profit(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
  v_employee_id uuid;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_employee_profit numeric := 0;
  v_item_profit numeric;
  v_item_percentage numeric;
  v_item_cost numeric;
  v_item_price numeric;
  v_items_with_rules_total numeric := 0;
  v_items_without_rules_total numeric := 0;
  v_discount_for_rules numeric := 0;
  v_increase_for_rules numeric := 0;
  v_order_discount numeric := 0;
  v_order_increase numeric := 0;
  v_has_rule boolean;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN RETURN NULL; END IF;
  v_employee_id := v_order.created_by;
  IF v_employee_id IS NULL THEN RETURN NULL; END IF;

  v_total_revenue := COALESCE(v_order.final_amount, v_order.total_amount, 0);
  v_order_discount := COALESCE(v_order.discount, 0);
  v_order_increase := COALESCE(v_order.price_increase, 0);

  FOR v_item IN SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
                FROM order_items oi WHERE oi.order_id = v_order.id LOOP
    v_item_price := COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity, 0);
    SELECT EXISTS(
      SELECT 1 FROM employee_profit_rules
      WHERE employee_id = v_employee_id AND is_active = true
        AND ((rule_type='product' AND target_id=v_item.product_id::text)
          OR (rule_type='variant' AND target_id=v_item.variant_id::text))
        AND created_at <= v_order.created_at
    ) INTO v_has_rule;
    IF v_has_rule THEN v_items_with_rules_total := v_items_with_rules_total + v_item_price;
    ELSE v_items_without_rules_total := v_items_without_rules_total + v_item_price; END IF;
  END LOOP;

  IF (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
    v_discount_for_rules := v_order_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    v_increase_for_rules := v_order_increase * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
  ELSE
    v_discount_for_rules := v_order_discount;
    v_increase_for_rules := v_order_increase;
  END IF;

  FOR v_item IN SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
                FROM order_items oi WHERE oi.order_id = v_order.id LOOP
    SELECT COALESCE(pv.cost_price, p.cost_price, 0) INTO v_item_cost
    FROM products p LEFT JOIN product_variants pv ON pv.id = v_item.variant_id WHERE p.id = v_item.product_id;
    v_total_cost := v_total_cost + (COALESCE(v_item_cost,0) * v_item.quantity);

    SELECT profit_amount, profit_percentage INTO v_item_profit, v_item_percentage
    FROM employee_profit_rules
    WHERE employee_id = v_employee_id AND is_active = true
      AND ((rule_type='product' AND target_id=v_item.product_id::text)
        OR (rule_type='variant' AND target_id=v_item.variant_id::text))
      AND created_at <= v_order.created_at
    ORDER BY CASE rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END LIMIT 1;

    IF COALESCE(v_item_percentage,0) = 100 THEN
      v_employee_profit := v_employee_profit + GREATEST(0, (COALESCE(v_item.unit_price,0) - COALESCE(v_item_cost,0)) * v_item.quantity);
    ELSE
      v_employee_profit := v_employee_profit + (COALESCE(v_item_profit,0) * v_item.quantity);
    END IF;
  END LOOP;

  -- القاعدة الحقيقية: قاعدة + زيادة - خصم (يسمح بالسالب)
  v_employee_profit := v_employee_profit + v_increase_for_rules - v_discount_for_rules;

  -- تحديث جدول الأرباح إذا كان موجود وغير مسوّى
  UPDATE profits
  SET employee_profit = v_employee_profit,
      total_revenue = v_total_revenue,
      total_cost = v_total_cost,
      profit_amount = v_total_revenue - v_total_cost,
      updated_at = NOW()
  WHERE order_id = p_order_id AND status != 'settled';

  RETURN v_employee_profit;
END;
$$;

-- 2) Back-fill: إعادة حساب جميع الطلبات المسلّمة غير المسوّاة التي بها زيادة أو خصم
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT o.id FROM orders o
    JOIN profits p ON p.order_id = o.id
    WHERE o.delivery_status = '4'
      AND p.status != 'settled'
      AND (COALESCE(o.discount,0) > 0 OR COALESCE(o.price_increase,0) > 0)
  LOOP
    PERFORM public.recompute_order_employee_profit(r.id);
  END LOOP;
END $$;
