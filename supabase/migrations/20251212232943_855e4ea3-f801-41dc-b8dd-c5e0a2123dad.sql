-- إنشاء جدول الخصومات المعلقة للموظفين
CREATE TABLE IF NOT EXISTS public.employee_pending_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT DEFAULT 'خصم على منتج بدون قاعدة ربح',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  applied_at TIMESTAMPTZ,
  applied_in_settlement_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.employee_pending_deductions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "المديرون يديرون خصومات الموظفين"
  ON public.employee_pending_deductions
  FOR ALL
  USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

CREATE POLICY "الموظفون يرون خصوماتهم"
  ON public.employee_pending_deductions
  FOR SELECT
  USING (employee_id = auth.uid());

-- Index for faster lookups
CREATE INDEX idx_employee_pending_deductions_employee ON public.employee_pending_deductions(employee_id, status);
CREATE INDEX idx_employee_pending_deductions_order ON public.employee_pending_deductions(order_id);

-- تعديل دالة إنشاء سجل الأرباح لتسجيل الخصومات المعلقة للمنتجات بدون قاعدة ربح
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
    -- Increase always goes to system, never affects employee profit
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
      CASE WHEN NEW.receipt_received THEN 'invoice_received' ELSE 'pending' END,
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = CASE WHEN NEW.receipt_received THEN 'invoice_received' ELSE profits.status END,
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة لجلب الخصومات المعلقة للموظف
CREATE OR REPLACE FUNCTION get_employee_pending_deductions(p_employee_id UUID)
RETURNS TABLE (
  total_pending_deductions NUMERIC,
  deductions_count INTEGER,
  deductions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(epd.amount), 0) as total_pending_deductions,
    COUNT(epd.id)::INTEGER as deductions_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', epd.id,
          'order_id', epd.order_id,
          'amount', epd.amount,
          'reason', epd.reason,
          'created_at', epd.created_at,
          'tracking_number', o.tracking_number
        )
      ) FILTER (WHERE epd.id IS NOT NULL),
      '[]'::jsonb
    ) as deductions
  FROM employee_pending_deductions epd
  LEFT JOIN orders o ON o.id = epd.order_id
  WHERE epd.employee_id = p_employee_id
    AND epd.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة لتطبيق الخصومات عند التحاسب
CREATE OR REPLACE FUNCTION apply_pending_deductions_on_settlement(
  p_employee_id UUID,
  p_settlement_id UUID,
  p_max_amount NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_total_applied NUMERIC := 0;
  v_remaining NUMERIC;
  v_deduction RECORD;
BEGIN
  v_remaining := COALESCE(p_max_amount, 999999999);
  
  -- Apply deductions in order of creation (oldest first)
  FOR v_deduction IN 
    SELECT id, amount 
    FROM employee_pending_deductions 
    WHERE employee_id = p_employee_id 
      AND status = 'pending'
    ORDER BY created_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;
    
    IF v_deduction.amount <= v_remaining THEN
      -- Apply full deduction
      UPDATE employee_pending_deductions
      SET status = 'applied',
          applied_at = NOW(),
          applied_in_settlement_id = p_settlement_id,
          updated_at = NOW()
      WHERE id = v_deduction.id;
      
      v_total_applied := v_total_applied + v_deduction.amount;
      v_remaining := v_remaining - v_deduction.amount;
    ELSE
      -- Partially apply deduction (split it)
      -- Create new record for remaining
      INSERT INTO employee_pending_deductions (
        employee_id, order_id, amount, reason, status, created_at
      )
      SELECT employee_id, order_id, amount - v_remaining, 
             reason || ' (متبقي)', 'pending', NOW()
      FROM employee_pending_deductions
      WHERE id = v_deduction.id;
      
      -- Apply partial amount
      UPDATE employee_pending_deductions
      SET amount = v_remaining,
          status = 'applied',
          applied_at = NOW(),
          applied_in_settlement_id = p_settlement_id,
          updated_at = NOW()
      WHERE id = v_deduction.id;
      
      v_total_applied := v_total_applied + v_remaining;
      v_remaining := 0;
    END IF;
  END LOOP;
  
  RETURN v_total_applied;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;