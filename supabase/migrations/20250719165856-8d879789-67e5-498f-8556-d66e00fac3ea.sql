-- تعديل الجدول ليكون is_active افتراضياً true للمنتجات الجديدة
ALTER TABLE public.products 
ALTER COLUMN is_active SET DEFAULT true;

-- تحديث المنتجات الحالية التي قد تكون null أو false لتصبح true
UPDATE public.products 
SET is_active = true 
WHERE is_active IS NULL OR is_active = false;