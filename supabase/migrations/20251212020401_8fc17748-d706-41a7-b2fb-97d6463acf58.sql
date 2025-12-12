-- ✅ إصلاح خطأ pv.cost في دالة auto_create_profit_record
-- المشكلة: الدالة تستخدم pv.cost بدلاً من pv.cost_price

CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_total_profit NUMERIC := 0;
  v_item_count INTEGER := 0;
  v_item RECORD;
  v_rule RECORD;
  v_item_profit NUMERIC;
  v_product_cost NUMERIC;
  v_discount_amount NUMERIC := 0;
  v_increase_amount NUMERIC := 0;
BEGIN
  -- Get employee ID from order
  v_employee_id := NEW.created_by;
  
  -- Calculate discount or increase impact
  v_discount_amount := COALESCE(NEW.discount, 0);
  v_increase_amount := COALESCE(NEW.price_increase, 0);
  
  -- Calculate profit from each order item based on employee profit rules
  FOR v_item IN 
    SELECT oi.*, p.category_id, p.department_id, p.product_type_id,
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
    v_item_count := v_item_count + 1;
    
    -- Check for product-specific rule first
    SELECT * INTO v_rule FROM employee_profit_rules 
    WHERE employee_id = v_employee_id 
      AND rule_type = 'product' 
      AND target_id = v_item.product_id::text
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      IF v_rule.profit_percentage IS NOT NULL AND v_rule.profit_percentage > 0 THEN
        v_item_profit := (v_item.unit_price - v_item.cost_price) * (v_rule.profit_percentage / 100) * v_item.quantity;
      ELSE
        v_item_profit := v_rule.profit_amount * v_item.quantity;
      END IF;
    ELSE
      -- Check for category rule
      SELECT * INTO v_rule FROM employee_profit_rules 
      WHERE employee_id = v_employee_id 
        AND rule_type = 'category' 
        AND target_id = v_item.category_id::text
        AND is_active = true
      LIMIT 1;
      
      IF FOUND THEN
        IF v_rule.profit_percentage IS NOT NULL AND v_rule.profit_percentage > 0 THEN
          v_item_profit := (v_item.unit_price - v_item.cost_price) * (v_rule.profit_percentage / 100) * v_item.quantity;
        ELSE
          v_item_profit := v_rule.profit_amount * v_item.quantity;
        END IF;
      ELSE
        -- Check for department rule
        SELECT * INTO v_rule FROM employee_profit_rules 
        WHERE employee_id = v_employee_id 
          AND rule_type = 'department' 
          AND target_id = v_item.department_id::text
          AND is_active = true
        LIMIT 1;
        
        IF FOUND THEN
          IF v_rule.profit_percentage IS NOT NULL AND v_rule.profit_percentage > 0 THEN
            v_item_profit := (v_item.unit_price - v_item.cost_price) * (v_rule.profit_percentage / 100) * v_item.quantity;
          ELSE
            v_item_profit := v_rule.profit_amount * v_item.quantity;
          END IF;
        END IF;
      END IF;
    END IF;
    
    v_total_profit := v_total_profit + COALESCE(v_item_profit, 0);
  END LOOP;
  
  -- ✅ Apply discount/increase impact: discount reduces profit, increase adds to profit
  v_total_profit := v_total_profit - v_discount_amount + v_increase_amount;
  
  -- Ensure profit doesn't go negative
  IF v_total_profit < 0 THEN
    v_total_profit := 0;
  END IF;
  
  -- Only create record if there's profit calculated
  IF v_total_profit > 0 THEN
    INSERT INTO order_employee_profits (
      order_id,
      employee_id,
      order_total_amount,
      employee_profit,
      discount_impact,
      increase_impact,
      profit_status,
      created_at
    ) VALUES (
      NEW.id,
      v_employee_id,
      NEW.final_amount,
      v_total_profit,
      v_discount_amount,
      v_increase_amount,
      'pending',
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      employee_profit = EXCLUDED.employee_profit,
      order_total_amount = EXCLUDED.order_total_amount,
      discount_impact = EXCLUDED.discount_impact,
      increase_impact = EXCLUDED.increase_impact,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;