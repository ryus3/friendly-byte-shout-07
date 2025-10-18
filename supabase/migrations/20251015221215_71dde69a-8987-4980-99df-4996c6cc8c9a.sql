-- إضافة أعمدة جديدة لتتبع تغيرات الأسعار
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS price_increase NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_change_type TEXT;

COMMENT ON COLUMN public.orders.price_increase IS 'مبلغ الزيادة في السعر من شركة التوصيل';
COMMENT ON COLUMN public.orders.price_change_type IS 'نوع تغيير السعر: discount أو increase';