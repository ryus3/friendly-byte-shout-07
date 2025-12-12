-- Fix auto_create_profit_record function to use correct 'profits' table instead of non-existent 'employee_profits'
CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id uuid;
  v_total_revenue numeric := 0;
  v_cost_price numeric := 0;
  v_employee_profit numeric := 0;
  v_item record;
  v_rule record;
  v_item_profit numeric;
  v_item_cost numeric;
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
    
    -- Calculate cost and employee profit from order items
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
      
      v_cost_price := v_cost_price + (COALESCE(v_item_cost, 0) * v_item.quantity);
      
      -- Get employee profit from rules
      SELECT profit_amount INTO v_item_profit
      FROM employee_profit_rules
      WHERE employee_id = v_employee_id
        AND is_active = true
        AND (
          (rule_type = 'product' AND target_id = v_item.product_id::text)
          OR (rule_type = 'variant' AND target_id = v_item.variant_id::text)
          OR rule_type = 'default'
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
    
    -- Apply discount/increase adjustments to employee profit
    v_employee_profit := v_employee_profit - COALESCE(NEW.discount, 0) + COALESCE(NEW.price_increase, 0);
    
    -- Insert or update profit record in correct 'profits' table
    INSERT INTO profits (
      employee_id,
      order_id,
      tracking_number,
      total_revenue,
      cost_price,
      employee_profit,
      profit_status,
      created_at,
      updated_at
    ) VALUES (
      v_employee_id,
      NEW.id,
      NEW.tracking_number,
      v_total_revenue,
      v_cost_price,
      v_employee_profit,
      CASE WHEN NEW.receipt_received THEN 'invoice_received' ELSE 'pending' END,
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      cost_price = EXCLUDED.cost_price,
      employee_profit = EXCLUDED.employee_profit,
      profit_status = CASE WHEN NEW.receipt_received THEN 'invoice_received' ELSE profits.profit_status END,
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;