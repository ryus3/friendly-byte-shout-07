-- إنشاء trigger لضمان created_by قبل الإدراج
CREATE TRIGGER ensure_orders_created_by_not_null
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_created_by_not_null();