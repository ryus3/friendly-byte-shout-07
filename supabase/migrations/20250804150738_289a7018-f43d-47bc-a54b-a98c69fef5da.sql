-- إنشاء حركة إرجاع للمصروف المحذوف بقيمة 4000
DO $$
DECLARE
  main_cash_id UUID;
  movement_result jsonb;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    -- إضافة حركة إرجاع للمصروف المحذوف بقيمة 4000
    SELECT public.update_cash_source_balance(
      main_cash_id,
      4000,
      'in',
      'expense_refund',
      '074946fd-2d9d-4cae-aab9-d04b9e1b4847'::uuid,
      'إرجاع مصروف محذوف بقيمة 4000 - تصحيح نهائي للرصيد',
      '91484496-b887-44f7-9e5d-be9db5567604'::uuid
    ) INTO movement_result;
    
    RAISE NOTICE 'تم إنشاء حركة إرجاع للمصروف المحذوف بقيمة 4000: %', movement_result;
  END IF;
END;
$$;