-- إصلاح بيانات منتج "برشلونه" وربطه بالعناصر المطلوبة بأمان دون استخدام ON CONFLICT

-- إنشاء السجلات الأساسية إذا لم تكن موجودة
INSERT INTO public.departments (name, description, icon, color)
SELECT 'ملابس', 'قسم الملابس والأزياء', 'Shirt', 'from-blue-500 to-blue-600'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'ملابس');

INSERT INTO public.categories (name, description, type)
SELECT 'رجالي', 'منتجات رجالية', 'main'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'رجالي');

INSERT INTO public.product_types (name, description)
SELECT 'تراك', 'طقم رياضي تراك'
WHERE NOT EXISTS (SELECT 1 FROM public.product_types WHERE name = 'تراك');

INSERT INTO public.seasons_occasions (name, type, description)
SELECT 'صيفي', 'season', 'موسم صيفي'
WHERE NOT EXISTS (SELECT 1 FROM public.seasons_occasions WHERE name = 'صيفي');

-- ربط المنتج "برشلونه" إذا كان موجوداً
WITH p AS (
  SELECT id FROM public.products WHERE name = 'برشلونه'
), d AS (
  SELECT id FROM public.departments WHERE name = 'ملابس'
), c AS (
  SELECT id FROM public.categories WHERE name = 'رجالي'
), pt AS (
  SELECT id FROM public.product_types WHERE name = 'تراك'
), so AS (
  SELECT id FROM public.seasons_occasions WHERE name = 'صيفي'
)
INSERT INTO public.product_departments (product_id, department_id)
SELECT p.id, d.id FROM p, d
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_departments x WHERE x.product_id = p.id AND x.department_id = d.id
);

WITH p AS (
  SELECT id FROM public.products WHERE name = 'برشلونه'
), c AS (
  SELECT id FROM public.categories WHERE name = 'رجالي'
)
INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, c.id FROM p, c
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories x WHERE x.product_id = p.id AND x.category_id = c.id
);

WITH p AS (
  SELECT id FROM public.products WHERE name = 'برشلونه'
), pt AS (
  SELECT id FROM public.product_types WHERE name = 'تراك'
)
INSERT INTO public.product_product_types (product_id, product_type_id)
SELECT p.id, pt.id FROM p, pt
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_product_types x WHERE x.product_id = p.id AND x.product_type_id = pt.id
);

WITH p AS (
  SELECT id FROM public.products WHERE name = 'برشلونه'
), so AS (
  SELECT id FROM public.seasons_occasions WHERE name = 'صيفي'
)
INSERT INTO public.product_seasons_occasions (product_id, season_occasion_id)
SELECT p.id, so.id FROM p, so
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_seasons_occasions x WHERE x.product_id = p.id AND x.season_occasion_id = so.id
);