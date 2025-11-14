-- إنشاء دالة لتصحيح بيانات التسليم الجزئي للطلب 112066293
CREATE OR REPLACE FUNCTION fix_partial_delivery_financials_112066293()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid := '37116ee2-7931-4674-9db6-9abccf21954a';
  v_result jsonb;
BEGIN
  -- تحديث جدول profits
  UPDATE profits
  SET 
    total_revenue = 33000.00,  -- 28,000 (المنتج M) + 5,000 (رسوم توصيل)
    profit_amount = 10500.00,  -- 33,000 - 17,500 (تكلفة) - 0 (ربح موظف)
    employee_profit = 0.00,    -- المدير العام لا يحصل على ربح
    updated_at = NOW()
  WHERE order_id = v_order_id;
  
  -- تحديث جدول partial_delivery_history
  UPDATE partial_delivery_history
  SET 
    delivered_revenue = 33000.00,    -- الإيراد الكامل
    delivery_fee_allocated = 5000.00, -- رسوم التوصيل كاملة
    employee_profit = 0.00,           -- لا ربح للمدير
    system_profit = 10500.00          -- كامل الربح للنظام
  WHERE order_id = v_order_id;
  
  -- إرجاع النتائج المحدثة
  SELECT jsonb_build_object(
    'success', true,
    'message', 'تم تصحيح البيانات المالية للطلب 112066293',
    'order_id', v_order_id,
    'total_revenue', 33000.00,
    'profit_amount', 10500.00,
    'employee_profit', 0.00,
    'system_profit', 10500.00
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- تشغيل الدالة لتصحيح البيانات
SELECT fix_partial_delivery_financials_112066293();