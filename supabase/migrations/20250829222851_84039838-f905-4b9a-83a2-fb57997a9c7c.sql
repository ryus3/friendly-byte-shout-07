-- إضافة العمود المفقود last_updated_by لجدول products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES auth.users(id);

-- تحديث القيم الفارغة بمعرف المستخدم الحالي أو المدير
UPDATE public.products 
SET last_updated_by = COALESCE(created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
WHERE last_updated_by IS NULL;

-- إضافة التصنيفات المفقودة لمنتج "برشلونة"
-- أولاً، نجد معرف المنتج
WITH barcelona_product AS (
  SELECT id FROM public.products WHERE name ILIKE '%برشلونة%' LIMIT 1
),
clothing_dept AS (
  SELECT id FROM public.departments WHERE name ILIKE '%ملابس%' LIMIT 1  
),
women_category AS (
  SELECT id FROM public.categories WHERE name ILIKE '%نسائي%' OR name ILIKE '%سيدات%' LIMIT 1
),
set_type AS (
  SELECT id FROM public.product_types WHERE name ILIKE '%طقم%' OR name ILIKE '%set%' LIMIT 1
),
summer_season AS (
  SELECT id FROM public.seasons_occasions WHERE name ILIKE '%صيف%' OR name ILIKE '%summer%' LIMIT 1
)

-- إضافة ربط القسم
INSERT INTO public.product_departments (product_id, department_id)
SELECT bp.id, cd.id 
FROM barcelona_product bp, clothing_dept cd
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_departments pd 
  WHERE pd.product_id = bp.id AND pd.department_id = cd.id
);

-- إضافة ربط التصنيف
INSERT INTO public.product_categories (product_id, category_id)
SELECT bp.id, wc.id 
FROM barcelona_product bp, women_category wc
WHERE wc.id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.product_categories pc 
  WHERE pc.product_id = bp.id AND pc.category_id = wc.id
);

-- إضافة ربط نوع المنتج
INSERT INTO public.product_product_types (product_id, product_type_id)
SELECT bp.id, st.id 
FROM barcelona_product bp, set_type st
WHERE st.id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.product_product_types ppt 
  WHERE ppt.product_id = bp.id AND ppt.product_type_id = st.id
);

-- إضافة ربط الموسم
INSERT INTO public.product_seasons_occasions (product_id, season_occasion_id)
SELECT bp.id, ss.id 
FROM barcelona_product bp, summer_season ss
WHERE ss.id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.product_seasons_occasions pso 
  WHERE pso.product_id = bp.id AND pso.season_occasion_id = ss.id
);