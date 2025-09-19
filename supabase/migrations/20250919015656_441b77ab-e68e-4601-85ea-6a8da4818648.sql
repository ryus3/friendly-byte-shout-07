-- إنشاء الـ trigger لتحديث الطلبات المسلمة تلقائياً
CREATE TRIGGER trigger_auto_update_delivered_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_delivered_order_status();

-- إصلاح الطلب الحالي ORD000015 
UPDATE public.orders 
SET status = 'delivered', updated_at = now()
WHERE order_number = 'ORD000015' AND delivery_status = '4';