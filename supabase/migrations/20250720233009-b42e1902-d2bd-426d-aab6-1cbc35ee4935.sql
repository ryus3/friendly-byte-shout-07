-- إنشاء trigger لتشغيل دالة حساب الأرباح عند استلام الفاتورة
DROP TRIGGER IF EXISTS trigger_auto_calculate_profit_on_receipt ON public.orders;

CREATE TRIGGER trigger_auto_calculate_profit_on_receipt
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_profit_on_receipt();

-- تحديث سجل الربح للطلب ORD000002 لأنه تم استلام فاتورته سابقاً
UPDATE public.profits 
SET status = 'invoice_received',
    updated_at = now()
WHERE order_id = '00798655-f91d-45d4-b1b5-e1dfc1a47266';

-- تحديث رصيد القاصة الرئيسية
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
  
  RAISE NOTICE 'تم تحديث رصيد القاصة الرئيسية إلى: %', new_balance;
END $$;