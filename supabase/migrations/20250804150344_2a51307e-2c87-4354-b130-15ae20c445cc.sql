-- إنشاء حركة إرجاع للمصروف المحذوف الأخير بقيمة 400
DO $$
DECLARE
  main_cash_id UUID;
  movement_result jsonb;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    -- إضافة حركة إرجاع للمصروف المحذوف بقيمة 400
    SELECT public.update_cash_source_balance(
      main_cash_id,
      400,
      'in',
      'expense_refund',
      NULL,
      'إرجاع مصروف محذوف - تصحيح الرصيد',
      NULL
    ) INTO movement_result;
    
    RAISE NOTICE 'تم إنشاء حركة إرجاع للمصروف المحذوف: %', movement_result;
  END IF;
END;
$$;