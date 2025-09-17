-- تنظيف الإشعارات المتضاربة وإصلاح أسعار منتج برشلونة

-- 1. حذف الإشعارات القديمة من نوع order_created لمنع التضارب
DELETE FROM public.notifications 
WHERE type = 'order_created' 
AND created_at >= now() - interval '7 days';

-- 2. توحيد أسعار جميع variants منتج برشلونة إلى 15,000
UPDATE public.product_variants 
SET price = 15000,
    updated_at = now()
WHERE product_id IN (
  SELECT id FROM public.products 
  WHERE LOWER(name) LIKE '%برشلونة%' OR LOWER(name) LIKE '%barcelona%'
)
AND price != 15000;

-- 3. تحديث أسعار المخزون للvariant المحدث
UPDATE public.inventory 
SET unit_price = 15000,
    updated_at = now()
WHERE variant_id IN (
  SELECT pv.id 
  FROM public.product_variants pv
  JOIN public.products p ON pv.product_id = p.id
  WHERE LOWER(p.name) LIKE '%برشلونة%' OR LOWER(p.name) LIKE '%barcelona%'
)
AND unit_price != 15000;