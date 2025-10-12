-- ========================================
-- المرحلة 4: دالة التحقق من سلسلة الحالات (21 ثم 17)
-- ========================================

CREATE OR REPLACE FUNCTION check_status_21_before_17(p_order_id uuid)
RETURNS boolean AS $$
DECLARE
  v_has_status_21 boolean;
BEGIN
  -- التحقق من وجود الحالة 21 في السجل
  SELECT EXISTS (
    SELECT 1 
    FROM order_status_history 
    WHERE order_id = p_order_id 
    AND new_delivery_status = '21'
  ) INTO v_has_status_21;
  
  RETURN v_has_status_21;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- المرحلة 5: دالة خصم الأرباح الآمنة (مع معالجة settled)
-- ========================================

CREATE OR REPLACE FUNCTION adjust_profit_for_return_safe(
  p_return_order_id uuid,
  p_original_order_id uuid,
  p_refund_amount numeric
) RETURNS jsonb AS $$
DECLARE
  v_profit_record RECORD;
  v_employee_percentage numeric;
  v_employee_refund_share numeric;
  v_system_refund_share numeric;
  v_new_profit numeric;
  v_new_employee_profit numeric;
  v_is_settled boolean;
  v_debt_id uuid;
BEGIN
  -- جلب سجل الربح الأصلي
  SELECT * INTO v_profit_record
  FROM profits
  WHERE order_id = p_original_order_id;
  
  IF v_profit_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على سجل ربح للطلب الأصلي'
    );
  END IF;
  
  -- التحقق من حالة التسوية
  v_is_settled := (v_profit_record.status = 'settled');
  v_employee_percentage := COALESCE(v_profit_record.employee_percentage, 0);
  
  -- حساب حصة الموظف من المرتجع
  v_employee_refund_share := (p_refund_amount * v_employee_percentage / 100);
  v_system_refund_share := p_refund_amount - v_employee_refund_share;
  
  IF v_is_settled THEN
    -- ✅ الربح مدفوع: تسجيل دين على الموظف
    INSERT INTO employee_debts (
      employee_id,
      order_id,
      original_order_id,
      debt_type,
      amount,
      description,
      status
    ) VALUES (
      v_profit_record.employee_id,
      p_return_order_id,
      p_original_order_id,
      'return_refund',
      v_employee_refund_share,
      'دين ناتج عن إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id) ||
      ' - الطلب الأصلي #' || (SELECT order_number FROM orders WHERE id = p_original_order_id),
      'pending'
    ) RETURNING id INTO v_debt_id;
    
    -- تسجيل في accounting
    INSERT INTO accounting (
      type,
      category,
      amount,
      description,
      reference_type,
      reference_id
    ) VALUES (
      'expense',
      'employee_debt_return',
      v_employee_refund_share,
      'دين موظف - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id
    );
    
    -- تسجيل خسارة النظام
    INSERT INTO accounting (
      type,
      category,
      amount,
      description,
      reference_type,
      reference_id
    ) VALUES (
      'expense',
      'system_refund',
      v_system_refund_share,
      'خسارة النظام - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id
    );
    
    -- إشعار للموظف
    INSERT INTO notifications (
      type,
      title,
      message,
      user_id,
      priority,
      data
    ) VALUES (
      'employee_debt',
      'تسجيل دين',
      'تم تسجيل دين بمبلغ ' || v_employee_refund_share || ' د.ع بسبب إرجاع الطلب',
      v_profit_record.employee_id,
      'high',
      jsonb_build_object(
        'debt_id', v_debt_id,
        'amount', v_employee_refund_share,
        'return_order_id', p_return_order_id,
        'original_order_id', p_original_order_id
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'settled', true,
      'debt_created', true,
      'debt_id', v_debt_id,
      'employee_debt_amount', v_employee_refund_share,
      'system_loss', v_system_refund_share
    );
    
  ELSE
    -- ✅ الربح غير مدفوع: خصم عادي
    v_new_profit := v_profit_record.profit_amount - p_refund_amount;
    v_new_employee_profit := v_profit_record.employee_profit - v_employee_refund_share;
    
    -- تحديث سجل الربح
    UPDATE profits
    SET 
      profit_amount = v_new_profit,
      employee_profit = v_new_employee_profit,
      total_revenue = total_revenue - p_refund_amount,
      updated_at = now()
    WHERE id = v_profit_record.id;
    
    -- تسجيل في accounting
    INSERT INTO accounting (
      type,
      category,
      amount,
      description,
      reference_type,
      reference_id
    ) VALUES (
      'expense',
      'employee_refund_deduction',
      v_employee_refund_share,
      'خصم من ربح الموظف - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id
    );
    
    INSERT INTO accounting (
      type,
      category,
      amount,
      description,
      reference_type,
      reference_id
    ) VALUES (
      'expense',
      'system_refund',
      v_system_refund_share,
      'خصم من ربح النظام - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'settled', false,
      'original_profit', v_profit_record.profit_amount,
      'new_profit', v_new_profit,
      'employee_refund_share', v_employee_refund_share,
      'system_refund_share', v_system_refund_share
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- المرحلة 6: دالة تسجيل حركة النقد للإرجاع
-- ========================================

CREATE OR REPLACE FUNCTION record_return_cash_movement(
  p_return_order_id uuid,
  p_refund_amount numeric,
  p_cash_source_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_cash_source_id uuid;
  v_current_balance numeric;
BEGIN
  -- اختيار مصدر النقد
  v_cash_source_id := COALESCE(
    p_cash_source_id, 
    (SELECT id FROM cash_sources WHERE type = 'cash' AND is_active = true ORDER BY created_at LIMIT 1)
  );
  
  IF v_cash_source_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مصدر نقد نشط');
  END IF;
  
  -- جلب الرصيد الحالي
  SELECT current_balance INTO v_current_balance
  FROM cash_sources
  WHERE id = v_cash_source_id;
  
  -- تسجيل حركة نقد خارجة
  INSERT INTO cash_movements (
    cash_source_id,
    amount,
    balance_before,
    balance_after,
    movement_type,
    description,
    reference_type,
    reference_id,
    created_by
  ) VALUES (
    v_cash_source_id,
    -p_refund_amount,
    v_current_balance,
    v_current_balance - p_refund_amount,
    'return_refund',
    'دفع للزبون - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
    'order',
    p_return_order_id,
    (SELECT created_by FROM orders WHERE id = p_return_order_id)
  );
  
  -- تحديث رصيد المصدر النقدي
  UPDATE cash_sources
  SET current_balance = current_balance - p_refund_amount,
      updated_at = now()
  WHERE id = v_cash_source_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'cash_source_id', v_cash_source_id,
    'amount', p_refund_amount,
    'new_balance', v_current_balance - p_refund_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;