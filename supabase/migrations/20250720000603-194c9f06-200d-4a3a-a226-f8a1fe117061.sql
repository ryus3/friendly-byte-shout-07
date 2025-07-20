-- تحديث عنصر الفاتورة لربطه بالـ variant الصحيح
UPDATE public.purchase_items 
SET variant_id = '14d565b3-cc5c-4539-93f5-eb5ff40d5a59'
WHERE purchase_id = '1fb6944a-e887-4ed2-9e21-0f4e7bbcaa27' 
  AND variant_id IS NULL;