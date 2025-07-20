-- إصلاح القاصة الرئيسية لتعرض الرصيد الصحيح تلقائياً
DO $$
DECLARE
  main_cash_id UUID;
  new_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id 
  FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- حذف أي حركات مالية خاطئة للأرباح المحققة
  DELETE FROM public.cash_movements 
  WHERE cash_source_id = main_cash_id 
  AND reference_type = 'realized_profit'
  AND amount = 21000;
  
  -- حساب الرصيد الصحيح
  SELECT public.calculate_main_cash_balance() INTO new_balance;
  
  -- تحديث القاصة الرئيسية بالرصيد الصحيح
  UPDATE public.cash_sources 
  SET current_balance = new_balance, updated_at = now()
  WHERE id = main_cash_id;
  
  RAISE NOTICE 'تم تحديث القاصة الرئيسية بالرصيد الصحيح: %', new_balance;
END $$;

-- إنشاء دالة لتحديث القاصة الرئيسية تلقائياً عند أي تغيير
CREATE OR REPLACE FUNCTION public.refresh_main_cash_balance()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  main_cash_id UUID;
  new_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id 
  FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    -- حساب الرصيد الجديد
    SELECT public.calculate_main_cash_balance() INTO new_balance;
    
    -- تحديث الرصيد
    UPDATE public.cash_sources 
    SET current_balance = new_balance, updated_at = now()
    WHERE id = main_cash_id;
  END IF;
END;
$$;