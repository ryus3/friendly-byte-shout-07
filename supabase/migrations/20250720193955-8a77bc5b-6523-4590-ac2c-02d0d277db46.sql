-- إصلاح نهائي: حذف جميع الـ triggers المكررة والإبقاء على الصحيح فقط

-- 1. حذف الـ triggers القديمة المكررة
DROP TRIGGER IF EXISTS calculate_profit_on_receipt_trigger ON public.orders;
DROP TRIGGER IF EXISTS trigger_calculate_profit_on_receipt ON public.orders;

-- 2. التأكد من وجود الـ trigger الصحيح فقط
DROP TRIGGER IF EXISTS trigger_process_order_profit_to_cash ON public.orders;

-- 3. إعادة إنشاء الـ trigger الصحيح
CREATE TRIGGER trigger_process_order_profit_to_cash
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_order_profit_to_cash();

-- 4. تحديث رصيد القاصة الرئيسية
SELECT public.recalculate_main_cash_balance();