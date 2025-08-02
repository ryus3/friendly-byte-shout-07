-- إصلاح تحذيرات الأمان - إضافة search_path للدوال الموجودة
ALTER FUNCTION public.reserve_stock_for_order(UUID, UUID, INTEGER) SET search_path TO 'public';
ALTER FUNCTION public.reserve_stock_on_order_create() SET search_path TO 'public';
ALTER FUNCTION public.finalize_stock_on_order_complete() SET search_path TO 'public';

-- إنشاء أو استبدال التريجرز للطلبات
DROP TRIGGER IF EXISTS reserve_stock_trigger ON public.orders;
DROP TRIGGER IF EXISTS finalize_stock_trigger ON public.orders;

CREATE TRIGGER reserve_stock_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reserve_stock_on_order_create();

CREATE TRIGGER finalize_stock_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.finalize_stock_on_order_complete();