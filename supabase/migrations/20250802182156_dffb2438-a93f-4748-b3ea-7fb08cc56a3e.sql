-- إزالة التريجرات الموجودة
DROP TRIGGER IF EXISTS order_status_change_trigger ON public.orders;
DROP TRIGGER IF EXISTS finalize_stock_trigger ON public.orders;
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete_trigger ON public.orders;

-- إنشاء التريجر الموحد الجديد
CREATE TRIGGER unified_order_status_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_status_change();