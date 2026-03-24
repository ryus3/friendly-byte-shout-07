
-- =============================================
-- المرحلة 0: تنظيف حركات "فيس" الخاطئة
-- =============================================
DELETE FROM cash_movements WHERE id IN (
  '88a98f9e-3cf5-4d22-a762-83e96f190c3b',
  '6f53bfd8-857a-43d4-a3d8-24973c42a1ee'
);

UPDATE cash_sources 
SET current_balance = 22242000, updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- =============================================
-- المرحلة 1: البنية التحتية للمركز المالي
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_financial_center BOOLEAN DEFAULT false;
ALTER TABLE cash_sources ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL;

-- دالة تفعيل المركز المالي لموظف
CREATE OR REPLACE FUNCTION setup_employee_financial_center(p_employee_id UUID, p_initial_balance NUMERIC DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_name TEXT;
  v_cash_source_id UUID;
BEGIN
  SELECT full_name INTO v_employee_name FROM profiles WHERE user_id = p_employee_id;
  IF v_employee_name IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود';
  END IF;
  
  IF EXISTS(SELECT 1 FROM profiles WHERE user_id = p_employee_id AND has_financial_center = true) THEN
    SELECT id INTO v_cash_source_id FROM cash_sources WHERE owner_user_id = p_employee_id AND is_active = true LIMIT 1;
    RETURN jsonb_build_object('success', true, 'message', 'المركز المالي مفعل مسبقاً', 'cash_source_id', v_cash_source_id);
  END IF;
  
  INSERT INTO cash_sources (name, type, description, initial_balance, current_balance, owner_user_id, created_by, is_active)
  VALUES (
    'قاصة ' || v_employee_name, 'employee_cash',
    'القاصة الخاصة بالموظف ' || v_employee_name,
    p_initial_balance, p_initial_balance, p_employee_id, p_employee_id, true
  ) RETURNING id INTO v_cash_source_id;
  
  UPDATE profiles SET has_financial_center = true WHERE user_id = p_employee_id;
  
  IF p_initial_balance > 0 THEN
    INSERT INTO cash_movements (cash_source_id, amount, movement_type, reference_type, description, created_by, balance_before, balance_after)
    VALUES (v_cash_source_id, p_initial_balance, 'in', 'capital_injection', 'رصيد افتتاحي لقاصة ' || v_employee_name, p_employee_id, 0, p_initial_balance);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'cash_source_id', v_cash_source_id, 'employee_name', v_employee_name);
END;
$$;

-- دالة تعطيل المركز المالي
CREATE OR REPLACE FUNCTION disable_employee_financial_center(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET has_financial_center = false WHERE user_id = p_employee_id;
  UPDATE cash_sources SET is_active = false WHERE owner_user_id = p_employee_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- تعديل دالة الإيرادات لتوجيه الأموال للقاصة الصحيحة
CREATE OR REPLACE FUNCTION record_order_revenue_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sales_amount NUMERIC;
  v_cash_source_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_has_fc BOOLEAN;
BEGIN
  IF NEW.receipt_received = true AND (OLD.receipt_received IS NULL OR OLD.receipt_received = false) THEN
    IF NEW.status IN ('returned', 'cancelled', 'rejected') THEN
      RETURN NEW;
    END IF;
    
    IF EXISTS(SELECT 1 FROM cash_movements WHERE reference_type = 'order' AND reference_id = NEW.id AND movement_type = 'in') THEN
      RETURN NEW;
    END IF;
    
    v_sales_amount := NEW.final_amount - COALESCE(NEW.delivery_fee, 0);
    
    SELECT has_financial_center INTO v_has_fc FROM profiles WHERE user_id = NEW.created_by;
    
    IF v_has_fc = true THEN
      SELECT id INTO v_cash_source_id FROM cash_sources WHERE owner_user_id = NEW.created_by AND is_active = true LIMIT 1;
    END IF;
    
    IF v_cash_source_id IS NULL THEN
      SELECT id INTO v_cash_source_id FROM cash_sources 
      WHERE is_active = true AND (owner_user_id IS NULL OR name = 'القاصة الرئيسية')
      ORDER BY created_at LIMIT 1;
    END IF;
    
    IF v_cash_source_id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد مصدر نقد نشط';
    END IF;
    
    SELECT current_balance INTO v_balance_before FROM cash_sources WHERE id = v_cash_source_id;
    v_balance_after := v_balance_before + v_sales_amount;
    
    INSERT INTO cash_movements (cash_source_id, movement_type, reference_type, reference_id, amount, balance_before, balance_after, description, created_by, effective_at)
    VALUES (v_cash_source_id, 'in', 'order', NEW.id, v_sales_amount, v_balance_before, v_balance_after,
      'إيراد من طلب ' || NEW.tracking_number, NEW.receipt_received_by, NEW.receipt_received_at);
    
    UPDATE cash_sources SET current_balance = v_balance_after WHERE id = v_cash_source_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- تعديل دالة المصاريف لتوجيه الخصم من القاصة الصحيحة
CREATE OR REPLACE FUNCTION handle_expense_cash_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cash_source_id UUID;
  v_has_fc BOOLEAN;
  movement_result jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT has_financial_center INTO v_has_fc FROM profiles WHERE user_id = OLD.created_by;
    IF v_has_fc = true THEN
      SELECT id INTO v_cash_source_id FROM cash_sources WHERE owner_user_id = OLD.created_by AND is_active = true LIMIT 1;
    END IF;
  ELSE
    SELECT has_financial_center INTO v_has_fc FROM profiles WHERE user_id = NEW.created_by;
    IF v_has_fc = true THEN
      SELECT id INTO v_cash_source_id FROM cash_sources WHERE owner_user_id = NEW.created_by AND is_active = true LIMIT 1;
    END IF;
  END IF;
  
  IF v_cash_source_id IS NULL THEN
    SELECT id INTO v_cash_source_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  END IF;
  
  IF v_cash_source_id IS NULL THEN
    RAISE WARNING 'لا توجد قاصة متاحة';
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' AND NEW.expense_type != 'system' AND NEW.category != 'مستحقات الموظفين' THEN
    SELECT public.update_cash_source_balance(v_cash_source_id, NEW.amount, 'out', 'expense', NEW.id, 'مصروف: ' || NEW.description, NEW.created_by) INTO movement_result;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' AND NEW.expense_type != 'system' AND NEW.category != 'مستحقات الموظفين' THEN
    SELECT public.update_cash_source_balance(v_cash_source_id, NEW.amount, 'out', 'expense', NEW.id, 'مصروف: ' || NEW.description, NEW.created_by) INTO movement_result;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' AND OLD.status = 'approved' AND OLD.expense_type != 'system' AND OLD.category != 'مستحقات الموظفين' THEN
    SELECT public.update_cash_source_balance(v_cash_source_id, OLD.amount, 'in', 'expense_refund', OLD.id, 'إرجاع مصروف محذوف: ' || OLD.description, OLD.created_by) INTO movement_result;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;
