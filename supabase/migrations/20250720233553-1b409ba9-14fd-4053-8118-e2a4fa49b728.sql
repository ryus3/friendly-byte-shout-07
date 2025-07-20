-- تحديث رصيد القاصة الرئيسية فوراً بالحساب الصحيح
DO $$
DECLARE
  main_cash_id UUID;
  new_balance NUMERIC;
  current_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id, current_balance INTO main_cash_id, current_balance 
  FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- حساب الرصيد الجديد
  SELECT public.calculate_main_cash_balance() INTO new_balance;
  
  -- تحديث الرصيد
  UPDATE public.cash_sources 
  SET current_balance = new_balance, updated_at = now()
  WHERE id = main_cash_id;
  
  RAISE NOTICE 'تم تحديث رصيد القاصة الرئيسية من % إلى %', current_balance, new_balance;
  
  -- إضافة حركة مالية لتوثيق الربح المحقق
  INSERT INTO public.cash_movements (
    cash_source_id,
    amount,
    movement_type,
    reference_type,
    reference_id,
    description,
    balance_before,
    balance_after,
    created_by
  ) VALUES (
    main_cash_id,
    21000,
    'in',
    'realized_profit',
    gen_random_uuid(),
    'أرباح محققة من الطلبات المستلمة فواتيرها',
    current_balance,
    new_balance,
    '91484496-b887-44f7-9e5d-be9db5567604'::uuid
  );
  
  RAISE NOTICE 'تم إضافة حركة مالية للأرباح المحققة';
END $$;