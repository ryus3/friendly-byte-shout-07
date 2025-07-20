-- فحص شامل وإصلاح القاصة الرئيسية
-- 1. حذف حركة رأس المال المضافة كحركة (هذا غلط كبير)
DELETE FROM public.cash_movements 
WHERE cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية')
AND reference_type = 'initial_capital';

-- 2. تحديث القاصة الرئيسية لتعكس رأس المال الصحيح من الإعدادات
DO $$
DECLARE
  main_cash_id UUID;
  capital_value NUMERIC;
  total_expenses NUMERIC;
  total_realized_profits NUMERIC;
  total_purchase_costs NUMERIC;
  new_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- الحصول على رأس المال من الإعدادات
  SELECT COALESCE((value)::numeric, 0) INTO capital_value FROM public.settings WHERE key = 'initial_capital';
  
  -- حساب إجمالي المصاريف المعتمدة
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses 
  FROM public.expenses 
  WHERE status = 'approved' AND expense_type != 'system';
  
  -- حساب الأرباح المحققة (من الطلبات التي تم استلام فواتيرها)
  SELECT COALESCE(SUM(o.final_amount), 0) INTO total_realized_profits
  FROM public.orders o
  WHERE o.status = 'completed' 
  AND o.payment_status = 'paid' 
  AND o.receipt_received = true;
  
  -- حساب تكلفة المشتريات من القاصة الرئيسية
  SELECT COALESCE(SUM(total_amount), 0) INTO total_purchase_costs
  FROM public.purchases
  WHERE cash_source_id = main_cash_id;
  
  -- حساب الرصيد الصحيح = رأس المال + الأرباح المحققة - المصاريف - تكلفة المشتريات
  new_balance := capital_value + total_realized_profits - total_expenses - total_purchase_costs;
  
  -- تحديث القاصة الرئيسية بالرصيد الصحيح
  UPDATE public.cash_sources 
  SET 
    initial_balance = capital_value,
    current_balance = new_balance,
    updated_at = now()
  WHERE id = main_cash_id;
  
  RAISE NOTICE 'تم تحديث القاصة الرئيسية: رأس المال=%, أرباح محققة=%, مصاريف=%, مشتريات=%, الرصيد النهائي=%', 
               capital_value, total_realized_profits, total_expenses, total_purchase_costs, new_balance;
END $$;

-- 3. التأكد من أن القاصة الرئيسية تتأثر بالأرباح والمصاريف
-- إنشاء دالة لحساب رصيد القاصة الرئيسية الصحيح
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  capital_value NUMERIC;
  total_expenses NUMERIC;
  total_realized_profits NUMERIC;
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
  
  -- حساب الأرباح المحققة
  SELECT COALESCE(SUM(o.final_amount), 0) INTO total_realized_profits
  FROM public.orders o
  WHERE o.status = 'completed' 
  AND o.payment_status = 'paid' 
  AND o.receipt_received = true;
  
  -- حساب تكلفة المشتريات
  SELECT COALESCE(SUM(total_amount), 0) INTO total_purchase_costs
  FROM public.purchases
  WHERE cash_source_id = main_cash_id;
  
  -- الرصيد = رأس المال + الأرباح - المصاريف - المشتريات
  result_balance := capital_value + total_realized_profits - total_expenses - total_purchase_costs;
  
  RETURN result_balance;
END;
$$;