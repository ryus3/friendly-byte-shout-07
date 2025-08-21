
-- 1) إضافة معرّف طلب شركة التوصيل إلى جدول الطلبات
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_partner_order_id text;

-- 2) فهرس لتحسين البحث بالمزامنة السريعة
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_order_id
ON public.orders (delivery_partner_order_id);
