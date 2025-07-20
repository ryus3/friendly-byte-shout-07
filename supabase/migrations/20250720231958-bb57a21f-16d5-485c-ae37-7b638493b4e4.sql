-- إصلاح دالة حساب رصيد القاصة الرئيسية لتشمل الأرباح المحققة الصحيحة
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  capital_value NUMERIC;
  total_expenses NUMERIC;
  total_manager_profits NUMERIC; -- صافي أرباح المدير المحققة
  total_purchase_costs NUMERIC;
  main_cash_id UUID;
  result_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- الحصول على رأس المال
  SELECT COALESCE((value)::numeric, 0) INTO capital_value FROM public.settings WHERE key = 'initial_capital';
  
  -- حساب المصاريف المعتمدة
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses 
  FROM public.expenses 
  WHERE status = 'approved' AND expense_type != 'system';
  
  -- حساب صافي أرباح المدير المحققة (من الطلبات التي تم استلام فواتيرها)
  SELECT COALESCE(SUM(p.profit_amount - p.employee_profit), 0) INTO total_manager_profits
  FROM public.profits p
  JOIN public.orders o ON p.order_id = o.id
  WHERE o.status = 'completed' 
  AND o.payment_status = 'paid' 
  AND o.receipt_received = true;
  
  -- حساب تكلفة المشتريات
  SELECT COALESCE(SUM(total_amount), 0) INTO total_purchase_costs
  FROM public.purchases
  WHERE cash_source_id = main_cash_id;
  
  -- الرصيد = رأس المال + أرباح المدير المحققة - المصاريف - المشتريات
  result_balance := capital_value + total_manager_profits - total_expenses - total_purchase_costs;
  
  -- تسجيل تفاصيل الحساب للمراجعة
  RAISE NOTICE 'حساب رصيد القاصة الرئيسية: رأس المال=%, أرباح المدير=%, مصاريف=%, مشتريات=%, الرصيد=%', 
               capital_value, total_manager_profits, total_expenses, total_purchase_costs, result_balance;
  
  RETURN result_balance;
END;
$$;

-- تحديث رصيد القاصة الرئيسية فوراً
DO $$
DECLARE
  main_cash_id UUID;
  new_balance NUMERIC;
BEGIN
  SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  SELECT public.calculate_main_cash_balance() INTO new_balance;
  
  UPDATE public.cash_sources 
  SET current_balance = new_balance, updated_at = now()
  WHERE id = main_cash_id;
  
  RAISE NOTICE 'تم تحديث رصيد القاصة الرئيسية إلى: %', new_balance;
END $$;