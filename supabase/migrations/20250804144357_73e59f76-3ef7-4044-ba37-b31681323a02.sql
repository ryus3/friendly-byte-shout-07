-- حذف الدالة القديمة الخطأ وتحديث الدالة calculate_main_cash_balance لتستخدم الدالة الجديدة
DROP FUNCTION IF EXISTS public.calculate_enhanced_main_cash_balance();

-- تحديث دالة calculate_main_cash_balance لتستخدم الدالة الجديدة الصحيحة
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance()
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result_data record;
BEGIN
  -- استخدام الدالة الصحيحة الوحيدة
  SELECT * INTO result_data FROM calculate_real_main_cash_balance();
  RETURN result_data.final_balance;
END;
$$;

-- تحديث رصيد القاصة الرئيسية للمرة الأخيرة بالرقم الصحيح
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
    
    RAISE NOTICE 'تم التحديث النهائي للرصيد الحقيقي: %', correct_balance;
  END IF;
END $$;