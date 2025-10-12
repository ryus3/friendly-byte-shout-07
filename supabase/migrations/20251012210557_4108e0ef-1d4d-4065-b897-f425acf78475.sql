-- المرحلة 2: RPC لمعالجة الأرباح في الإرجاع بدقة كاملة
CREATE OR REPLACE FUNCTION adjust_profit_for_return_v2(
  p_original_order_id uuid,
  p_refund_amount numeric,
  p_product_profit numeric,
  p_return_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profit_record RECORD;
  v_employee_profit_share numeric;
  v_system_profit_share numeric;
  v_revenue_deduction numeric;
  v_new_profit numeric;
  v_new_employee_profit numeric;
  v_new_revenue numeric;
BEGIN
  -- جلب سجل الربح الأصلي
  SELECT * INTO v_profit_record
  FROM profits
  WHERE order_id = p_original_order_id
  LIMIT 1;
  
  IF v_profit_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم العثور على سجل ربح');
  END IF;
  
  -- حساب التوزيع الصحيح:
  -- 1. من الربح: خصم ربح المنتج فقط
  -- 2. من الإيراد: خصم الباقي (refund_amount - product_profit)
  
  v_revenue_deduction := p_refund_amount - p_product_profit;
  
  -- حصة الموظف من ربح المنتج
  v_employee_profit_share := (COALESCE(v_profit_record.employee_percentage, 0) / 100.0) * p_product_profit;
  v_system_profit_share := p_product_profit - v_employee_profit_share;
  
  -- حساب الأرباح الجديدة
  v_new_profit := GREATEST(0, v_profit_record.profit_amount - p_product_profit);
  v_new_employee_profit := GREATEST(0, v_profit_record.employee_profit - v_employee_profit_share);
  v_new_revenue := GREATEST(0, v_profit_record.total_revenue - p_refund_amount);
  
  -- تحديث سجل الربح
  UPDATE profits
  SET 
    profit_amount = v_new_profit,
    employee_profit = v_new_employee_profit,
    total_revenue = v_new_revenue,
    updated_at = now()
  WHERE id = v_profit_record.id;
  
  -- تسجيل في accounting (3 إدخالات)
  
  -- 1. خصم أرباح الموظف (إذا كان موجود)
  IF v_employee_profit_share > 0 THEN
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id, employee_id,
      created_by, created_at
    ) VALUES (
      'expense',
      'employee_refund',
      v_employee_profit_share,
      'خصم أرباح موظف - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id,
      v_profit_record.employee_id,
      v_profit_record.employee_id,
      now()
    );
  END IF;
  
  -- 2. خصم أرباح النظام
  IF v_system_profit_share > 0 THEN
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id,
      created_by, created_at
    ) VALUES (
      'expense',
      'system_refund',
      v_system_profit_share,
      'خصم أرباح نظام - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id,
      v_profit_record.employee_id,
      now()
    );
  END IF;
  
  -- 3. خصم من الإيراد
  IF v_revenue_deduction > 0 THEN
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id,
      created_by, created_at
    ) VALUES (
      'expense',
      'revenue_refund',
      v_revenue_deduction,
      'خصم من إيراد - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id,
      v_profit_record.employee_id,
      now()
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'product_profit', p_product_profit,
    'employee_share', v_employee_profit_share,
    'system_share', v_system_profit_share,
    'revenue_deduction', v_revenue_deduction,
    'new_revenue', v_new_revenue,
    'new_profit', v_new_profit,
    'new_employee_profit', v_new_employee_profit
  );
END;
$function$;