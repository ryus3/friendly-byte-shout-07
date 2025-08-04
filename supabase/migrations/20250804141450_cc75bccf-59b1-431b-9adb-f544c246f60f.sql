-- إضافة حركة رأس المال الحقيقية للقاصة الرئيسية
INSERT INTO cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  description,
  balance_before,
  balance_after,
  created_by
) 
SELECT 
  cs.id,
  5114000,
  'in',
  'capital_injection',
  'رأس المال الأساسي للشركة',
  0,
  5114000,
  COALESCE(
    (SELECT user_id FROM profiles WHERE full_name LIKE '%admin%' OR username LIKE '%admin%' LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
FROM cash_sources cs 
WHERE cs.name = 'القاصة الرئيسية'
AND NOT EXISTS (
  SELECT 1 FROM cash_movements cm 
  WHERE cm.cash_source_id = cs.id 
  AND cm.reference_type = 'capital_injection'
  AND cm.amount = 5114000
);

-- تحديث رصيد القاصة الرئيسية بالقيمة الصحيحة
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
    
    RAISE NOTICE 'تم تحديث رصيد القاصة الرئيسية إلى: %', real_balance;
  END IF;
END $$;