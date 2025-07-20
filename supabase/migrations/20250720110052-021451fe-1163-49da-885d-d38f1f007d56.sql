-- إعادة تفعيل الـ trigger الأصلي الصحيح
CREATE TRIGGER trigger_calculate_profit_on_receipt
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_profit_on_receipt();