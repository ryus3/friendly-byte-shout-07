-- تصحيح حالة الطلب ORD000002 من delivered إلى completed لأنه تم استلام فاتورته
UPDATE public.orders 
SET status = 'completed',
    updated_at = now()
WHERE order_number = 'ORD000002' 
AND receipt_received = true;

-- تحديث رصيد القاصة الرئيسية بعد تصحيح حالة الطلب
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
  
  RAISE NOTICE 'تم تصحيح حالة الطلب وتحديث رصيد القاصة إلى: %', new_balance;
END $$;