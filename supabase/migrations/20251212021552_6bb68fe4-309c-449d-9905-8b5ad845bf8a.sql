-- ============================================
-- 1. إصلاح دالة auto_create_profit_record
-- ============================================
CREATE OR REPLACE FUNCTION auto_create_profit_record()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id uuid;
  v_item RECORD;
  v_rule RECORD;
  v_item_profit numeric := 0;
  v_total_profit numeric := 0;
  v_cost_total numeric := 0;
  v_sales_total numeric := 0;
BEGIN
  -- Only process delivered orders
  IF NEW.delivery_status != '4' OR OLD.delivery_status = '4' THEN
    RETURN NEW;
  END IF;

  -- Get employee who created the order
  v_employee_id := NEW.created_by;
  IF v_employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate profit for each item
  FOR v_item IN 
    SELECT oi.*, p.category_id,
           -- الحصول على القسم من جدول العلاقات
           (SELECT pd.department_id FROM product_departments pd WHERE pd.product_id = p.id LIMIT 1) as department_id,
           -- الحصول على نوع المنتج من جدول العلاقات
           (SELECT ppt.product_type_id FROM product_product_types ppt WHERE ppt.product_id = p.id LIMIT 1) as product_type_id,
           COALESCE(
             (SELECT pv.cost_price FROM product_variants pv WHERE pv.id = oi.variant_id),
             (SELECT p2.cost_price FROM products p2 WHERE p2.id = oi.product_id),
             0
           ) as cost_price
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    v_item_profit := 0;
    
    -- Calculate cost and sales
    v_cost_total := v_cost_total + (COALESCE(v_item.cost_price, 0) * v_item.quantity);
    v_sales_total := v_sales_total + COALESCE(v_item.total_price, 0);

    -- Find matching profit rule (product > category > department)
    SELECT * INTO v_rule FROM employee_profit_rules 
    WHERE employee_id = v_employee_id 
      AND is_active = true 
      AND rule_type = 'product' 
      AND target_id = v_item.product_id::text
    LIMIT 1;

    IF v_rule IS NULL AND v_item.category_id IS NOT NULL THEN
      SELECT * INTO v_rule FROM employee_profit_rules 
      WHERE employee_id = v_employee_id 
        AND is_active = true 
        AND rule_type = 'category' 
        AND target_id = v_item.category_id::text
      LIMIT 1;
    END IF;

    IF v_rule IS NULL AND v_item.department_id IS NOT NULL THEN
      SELECT * INTO v_rule FROM employee_profit_rules 
      WHERE employee_id = v_employee_id 
        AND is_active = true 
        AND rule_type = 'department' 
        AND target_id = v_item.department_id::text
      LIMIT 1;
    END IF;

    IF v_rule IS NOT NULL THEN
      IF v_rule.profit_percentage IS NOT NULL AND v_rule.profit_percentage > 0 THEN
        v_item_profit := (v_item.total_price * v_rule.profit_percentage / 100) * v_item.quantity;
      ELSE
        v_item_profit := v_rule.profit_amount * v_item.quantity;
      END IF;
    END IF;

    v_total_profit := v_total_profit + v_item_profit;
  END LOOP;

  -- Apply discount/increase adjustments
  v_total_profit := v_total_profit - COALESCE(NEW.discount, 0) + COALESCE(NEW.price_increase, 0);

  -- Ensure profit is not negative
  IF v_total_profit < 0 THEN
    v_total_profit := 0;
  END IF;

  -- Insert profit record if there's any profit
  IF v_total_profit > 0 THEN
    INSERT INTO employee_profits (
      employee_id, order_id, profit_amount, cost_amount, sales_amount,
      profit_date, status, created_at
    ) VALUES (
      v_employee_id, NEW.id, v_total_profit, v_cost_total, v_sales_total,
      CURRENT_DATE, 'pending', NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      profit_amount = EXCLUDED.profit_amount,
      cost_amount = EXCLUDED.cost_amount,
      sales_amount = EXCLUDED.sales_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- 2. Trigger لتحويل الطلب لتسليم جزئي عند الحالة 21
-- ============================================
CREATE OR REPLACE FUNCTION convert_to_partial_delivery_on_status_21()
RETURNS TRIGGER AS $$
BEGIN
  -- عند المرور بالحالة 21، تحويل الطلب لتسليم جزئي نهائياً
  IF NEW.delivery_status = '21' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '21') THEN
    NEW.order_type := 'partial_delivery';
    NEW.is_partial_delivery := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS trg_convert_partial_on_21 ON orders;

-- إنشاء الـ trigger الجديد
CREATE TRIGGER trg_convert_partial_on_21
BEFORE UPDATE OF delivery_status ON orders
FOR EACH ROW
EXECUTE FUNCTION convert_to_partial_delivery_on_status_21();

-- ============================================
-- 3. إصلاح الطلب 116266990
-- ============================================
UPDATE orders 
SET order_type = 'partial_delivery', is_partial_delivery = true 
WHERE tracking_number = '116266990';