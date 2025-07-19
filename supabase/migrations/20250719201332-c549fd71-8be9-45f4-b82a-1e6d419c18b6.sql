-- إضافة حقل التلميح الذكي للمتغيرات
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS hint TEXT DEFAULT '';