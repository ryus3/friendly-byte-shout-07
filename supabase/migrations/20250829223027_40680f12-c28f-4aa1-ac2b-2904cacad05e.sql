-- إضافة التصنيفات المفقودة لمنتج "برشلونة"
-- نبدأ بالبحث عن معرف المنتج والتصنيفات المطلوبة

-- إضافة ربط القسم (ملابس)
INSERT INTO public.product_departments (product_id, department_id)
SELECT p.id, d.id 
FROM public.products p, public.departments d
WHERE p.name ILIKE '%برشلونة%' 
AND d.name ILIKE '%ملابس%'
AND NOT EXISTS (
  SELECT 1 FROM public.product_departments pd 
  WHERE pd.product_id = p.id AND pd.department_id = d.id
);

-- إضافة ربط التصنيف (نسائي)
INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, c.id 
FROM public.products p, public.categories c
WHERE p.name ILIKE '%برشلونة%' 
AND (c.name ILIKE '%نسائي%' OR c.name ILIKE '%سيدات%')
AND NOT EXISTS (
  SELECT 1 FROM public.product_categories pc 
  WHERE pc.product_id = p.id AND pc.category_id = c.id
);

-- إضافة ربط نوع المنتج (طقم)
INSERT INTO public.product_product_types (product_id, product_type_id)
SELECT p.id, pt.id 
FROM public.products p, public.product_types pt
WHERE p.name ILIKE '%برشلونة%' 
AND (pt.name ILIKE '%طقم%' OR pt.name ILIKE '%set%')
AND NOT EXISTS (
  SELECT 1 FROM public.product_product_types ppt 
  WHERE ppt.product_id = p.id AND ppt.product_type_id = pt.id
);

-- إضافة ربط الموسم (صيفي)
INSERT INTO public.product_seasons_occasions (product_id, season_occasion_id)
SELECT p.id, so.id 
FROM public.products p, public.seasons_occasions so
WHERE p.name ILIKE '%برشلونة%' 
AND (so.name ILIKE '%صيف%' OR so.name ILIKE '%summer%')
AND NOT EXISTS (
  SELECT 1 FROM public.product_seasons_occasions pso 
  WHERE pso.product_id = p.id AND pso.season_occasion_id = so.id
);