-- تنظيف الحركات المكررة والخاطئة وإعادة حساب الرصيد الصحيح
DO $$ 
DECLARE
  main_cash_id UUID;
  correct_balance NUMERIC;
  current_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- حذف الحركات المكررة للأرباح القديمة (realized_profit)
  DELETE FROM cash_movements 
  WHERE reference_type = 'realized_profit'
  AND cash_source_id = main_cash_id;
  
  RAISE NOTICE 'تم حذف حركات الأرباح المكررة';
  
  -- حساب الرصيد الصحيح من الدالة المحسنة
  SELECT final_balance INTO correct_balance 
  FROM public.calculate_enhanced_main_cash_balance() 
  LIMIT 1;
  
  -- الحصول على الرصيد الحالي
  SELECT current_balance INTO current_balance 
  FROM cash_sources 
  WHERE id = main_cash_id;
  
  -- تصحيح الرصيد إذا كان مختلفاً
  IF current_balance != correct_balance THEN
    UPDATE cash_sources 
    SET current_balance = correct_balance, updated_at = now()
    WHERE id = main_cash_id;
    
    -- إضافة حركة تصحيح
    INSERT INTO cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      description,
      balance_before,
      balance_after,
      created_by
    ) VALUES (
      main_cash_id,
      ABS(correct_balance - current_balance),
      CASE WHEN correct_balance > current_balance THEN 'in' ELSE 'out' END,
      'adjustment',
      'تصحيح الرصيد ليتطابق مع النظام المحسن',
      current_balance,
      correct_balance,
      '91484496-b887-44f7-9e5d-be9db5567604'
    );
    
    RAISE NOTICE 'تم تصحيح الرصيد من % إلى %', current_balance, correct_balance;
  END IF;
  
END $$;