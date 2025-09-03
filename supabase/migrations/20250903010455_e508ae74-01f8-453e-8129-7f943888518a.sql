
-- إضافة حقول معرفات مدينة/قضاء الوسيط لجدول الطلبات
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS alwaseet_city_id integer,
ADD COLUMN IF NOT EXISTS alwaseet_region_id integer;

-- اختياري: فهرسة بسيطة لتحسين الاستعلامات المستقبلية (ليست ضرورية الآن)
-- CREATE INDEX IF NOT EXISTS idx_orders_alwaseet_city_id ON public.orders (alwaseet_city_id);
-- CREATE INDEX IF NOT EXISTS idx_orders_alwaseet_region_id ON public.orders (alwaseet_region_id);
