-- إنشاء دالة محسّنة لحساب الرصيد الحقيقي للقاصة الرئيسية
CREATE OR REPLACE FUNCTION public.calculate_real_main_cash_balance()
RETURNS TABLE(
  final_balance numeric,
  capital_amount numeric,
  real_sales numeric,
  delivery_fees numeric,
  total_revenue numeric,
  real_employee_dues numeric,
  general_expenses numeric,
  purchase_costs numeric,
  net_profit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_source_id uuid;
  real_capital numeric := 0;
  sales_without_delivery numeric := 0;
  total_delivery numeric := 0;
  total_sales_revenue numeric := 0;
  employee_dues_paid numeric := 0;
  general_exp numeric := 0;
  purchases_paid numeric := 0;
  calculated_profit numeric := 0;
  final_balance_result numeric := 0;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM cash_sources 
  WHERE name = 'القاصة الرئيسية' 
  LIMIT 1;
  
  -- 1. رأس المال الحقيقي من initial_balance
  SELECT COALESCE(initial_balance, 0) INTO real_capital
  FROM cash_sources 
  WHERE id = main_cash_source_id;
  
  -- 2. المبيعات الحقيقية (بدون أجور التوصيل) من الطلبات المكتملة والمستلمة فقط
  SELECT 
    COALESCE(SUM(o.total_amount - COALESCE(o.delivery_fee, 0)), 0),
    COALESCE(SUM(COALESCE(o.delivery_fee, 0)), 0),
    COALESCE(SUM(o.total_amount), 0)
  INTO sales_without_delivery, total_delivery, total_sales_revenue
  FROM orders o
  WHERE o.status IN ('completed', 'delivered')
  AND o.receipt_received = true;
  
  -- 3. مستحقات الموظفين المدفوعة فعلياً (مرتبطة بفواتير حقيقية)
  SELECT COALESCE(SUM(e.amount), 0) INTO employee_dues_paid
  FROM expenses e
  WHERE e.status = 'approved'
  AND (e.expense_type = 'system' OR e.category = 'مستحقات الموظفين')
  AND e.receipt_number IS NOT NULL; -- مرتبطة بفواتير حقيقية
  
  -- 4. المصاريف العامة المعتمدة (بدون مستحقات الموظفين)
  SELECT COALESCE(SUM(e.amount), 0) INTO general_exp
  FROM expenses e
  WHERE e.status = 'approved'
  AND e.expense_type != 'system'
  AND e.category != 'مستحقات الموظفين';
  
  -- 5. تكلفة المشتريات المدفوعة من القاصة الرئيسية
  SELECT COALESCE(SUM(p.total_amount), 0) INTO purchases_paid
  FROM purchases p
  WHERE p.status = 'completed'
  AND p.cash_source_id = main_cash_source_id;
  
  -- 6. حساب صافي الربح الحقيقي
  calculated_profit := sales_without_delivery - employee_dues_paid - general_exp - purchases_paid;
  
  -- 7. الرصيد النهائي الحقيقي = رأس المال + صافي الربح
  final_balance_result := real_capital + calculated_profit;
  
  -- إرجاع جميع التفاصيل
  RETURN QUERY SELECT 
    final_balance_result as final_balance,
    real_capital as capital_amount,
    sales_without_delivery as real_sales,
    total_delivery as delivery_fees,
    total_sales_revenue as total_revenue,
    employee_dues_paid as real_employee_dues,
    general_exp as general_expenses,
    purchases_paid as purchase_costs,
    calculated_profit as net_profit;
END;
$$;

-- تحديث رصيد القاصة الرئيسية باستخدام الدالة الجديدة
DO $$
DECLARE
  main_cash_id uuid;
  correct_balance numeric;
BEGIN
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    SELECT final_balance INTO correct_balance FROM calculate_real_main_cash_balance();
    
    UPDATE cash_sources 
    SET current_balance = correct_balance, updated_at = now()
    WHERE id = main_cash_id;
    
    RAISE NOTICE 'تم تحديث الرصيد إلى الرقم الحقيقي: %', correct_balance;
  END IF;
END $$;