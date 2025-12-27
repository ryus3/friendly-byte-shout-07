-- تحديث دالة auto_create_profit_record لتؤرشف تلقائياً الطلبات ذات employee_profit = 0
CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id uuid;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_employee_profit numeric := 0;
  v_profit_amount numeric := 0;
  v_item record;
  v_item_profit numeric;
  v_item_cost numeric;
  v_item_price numeric;
  v_items_with_rules_total numeric := 0;
  v_items_without_rules_total numeric := 0;
  v_discount_for_rules numeric := 0;
  v_discount_for_no_rules numeric := 0;
  v_order_discount numeric := 0;
  v_has_rule boolean;
  v_final_status text;
BEGIN
  -- Only process when order is delivered (delivery_status = '4')
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    
    -- Get the employee who created the order
    v_employee_id := NEW.created_by;
    
    -- Skip if no employee
    IF v_employee_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Calculate total revenue from order
    v_total_revenue := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    v_order_discount := COALESCE(NEW.discount, 0);
    
    -- First pass: categorize items by whether they have profit rules
    FOR v_item IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      v_item_price := COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity, 0);
      
      -- Check if employee has profit rule for this item
      SELECT EXISTS(
        SELECT 1 FROM employee_profit_rules
        WHERE employee_id = v_employee_id
          AND is_active = true
          AND (
            (rule_type = 'product' AND target_id = v_item.product_id::text)
            OR (rule_type = 'variant' AND target_id = v_item.variant_id::text)
          )
          AND created_at <= NEW.created_at
      ) INTO v_has_rule;
      
      IF v_has_rule THEN
        v_items_with_rules_total := v_items_with_rules_total + v_item_price;
      ELSE
        v_items_without_rules_total := v_items_without_rules_total + v_item_price;
      END IF;
    END LOOP;
    
    -- Calculate proportional discount distribution
    IF (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
      v_discount_for_rules := v_order_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_discount_for_no_rules := v_order_discount * (v_items_without_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    END IF;
    
    -- Second pass: calculate costs and employee profit
    FOR v_item IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- Get cost price from variant or product
      SELECT COALESCE(pv.cost_price, p.cost_price, 0) INTO v_item_cost
      FROM products p
      LEFT JOIN product_variants pv ON pv.id = v_item.variant_id
      WHERE p.id = v_item.product_id;
      
      v_total_cost := v_total_cost + (COALESCE(v_item_cost, 0) * v_item.quantity);
      
      -- Get employee profit from rules
      SELECT profit_amount INTO v_item_profit
      FROM employee_profit_rules
      WHERE employee_id = v_employee_id
        AND is_active = true
        AND (
          (rule_type = 'product' AND target_id = v_item.product_id::text)
          OR (rule_type = 'variant' AND target_id = v_item.variant_id::text)
        )
        AND created_at <= NEW.created_at
      ORDER BY 
        CASE rule_type 
          WHEN 'variant' THEN 1 
          WHEN 'product' THEN 2 
          ELSE 3 
        END
      LIMIT 1;
      
      v_employee_profit := v_employee_profit + (COALESCE(v_item_profit, 0) * v_item.quantity);
    END LOOP;
    
    -- Calculate profit amount (revenue - cost)
    v_profit_amount := v_total_revenue - v_total_cost;
    
    -- Apply discount ONLY for items with profit rules (deduct from employee profit)
    v_employee_profit := v_employee_profit - v_discount_for_rules;
    
    -- Ensure employee profit doesn't go negative
    IF v_employee_profit < 0 THEN
      v_employee_profit := 0;
    END IF;
    
    -- Record pending deduction for items WITHOUT profit rules (if any discount applies)
    IF v_discount_for_no_rules > 0 THEN
      INSERT INTO employee_pending_deductions (
        employee_id,
        order_id,
        amount,
        reason,
        status,
        created_at
      ) VALUES (
        v_employee_id,
        NEW.id,
        v_discount_for_no_rules,
        'خصم نسبي على منتجات بدون قاعدة ربح - طلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
        'pending',
        NOW()
      );
    END IF;
    
    -- ✅ تحديد الحالة بناءً على ربح الموظف
    -- إذا كان ربح الموظف = 0، نؤرشفه تلقائياً
    IF v_employee_profit = 0 THEN
      v_final_status := 'no_rule_archived';
    ELSIF NEW.receipt_received THEN
      v_final_status := 'invoice_received';
    ELSE
      v_final_status := 'pending';
    END IF;
    
    -- Insert or update profit record
    INSERT INTO profits (
      employee_id,
      order_id,
      total_revenue,
      total_cost,
      profit_amount,
      employee_percentage,
      employee_profit,
      status,
      settled_at,
      created_at,
      updated_at
    ) VALUES (
      v_employee_id,
      NEW.id,
      v_total_revenue,
      v_total_cost,
      v_profit_amount,
      0,
      v_employee_profit,
      v_final_status,
      CASE WHEN v_employee_profit = 0 THEN NOW() ELSE NULL END,
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = CASE 
        WHEN EXCLUDED.employee_profit = 0 THEN 'no_rule_archived'
        WHEN NEW.receipt_received THEN 'invoice_received' 
        ELSE profits.status 
      END,
      settled_at = CASE 
        WHEN EXCLUDED.employee_profit = 0 THEN NOW() 
        ELSE profits.settled_at 
      END,
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث أي طلبات حالية بـ employee_profit = 0 و status = 'pending'
UPDATE profits 
SET 
  status = 'no_rule_archived',
  settled_at = NOW()
WHERE employee_profit = 0 
  AND status = 'pending';