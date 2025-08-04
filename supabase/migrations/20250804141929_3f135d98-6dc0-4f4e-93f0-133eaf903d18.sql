-- حذف الحركة التي أضفتها خطأ
DELETE FROM cash_movements 
WHERE reference_type = 'capital_injection' 
AND amount = 5114000 
AND description = 'رأس المال الأساسي للشركة';

-- إعادة تحديث رصيد القاصة الرئيسية بالقيمة الصحيحة
DO $$
DECLARE
  main_cash_id uuid;
  real_balance numeric;
BEGIN
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    SELECT final_balance INTO real_balance FROM calculate_enhanced_main_cash_balance();
    
    UPDATE cash_sources 
    SET current_balance = real_balance, updated_at = now()
    WHERE id = main_cash_id;
    
    RAISE NOTICE 'تم إعادة تحديث رصيد القاصة الرئيسية إلى: %', real_balance;
  END IF;
END $$;