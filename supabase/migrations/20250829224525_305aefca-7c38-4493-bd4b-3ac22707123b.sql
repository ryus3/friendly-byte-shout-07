-- إصلاح بيانات منتج برشلونه وإنشاء العناصر المطلوبة إن لم توجد

-- إنشاء الأقسام المطلوبة إن لم توجد
INSERT INTO public.departments (name, description, icon, color) 
VALUES ('ملابس', 'قسم الملابس والأزياء', 'Shirt', 'from-blue-500 to-blue-600')
ON CONFLICT (name) DO NOTHING;

-- إنشاء التصنيفات المطلوبة إن لم توجد
INSERT INTO public.categories (name, description, type) 
VALUES ('رجالي', 'منتجات رجالية', 'main')
ON CONFLICT (name) DO NOTHING;

-- إنشاء أنواع المنتجات المطلوبة إن لم توجد
INSERT INTO public.product_types (name, description) 
VALUES ('تراك', 'طقم رياضي تراك')
ON CONFLICT (name) DO NOTHING;

-- إنشاء المواسم المطلوبة إن لم توجد
INSERT INTO public.seasons_occasions (name, type, description) 
VALUES ('صيفي', 'season', 'موسم صيفي')
ON CONFLICT (name) DO NOTHING;

-- الحصول على معرفات العناصر
WITH required_ids AS (
  SELECT 
    d.id as department_id,
    c.id as category_id,
    pt.id as product_type_id,
    so.id as season_occasion_id,
    p.id as product_id
  FROM public.products p
  CROSS JOIN public.departments d
  CROSS JOIN public.categories c  
  CROSS JOIN public.product_types pt
  CROSS JOIN public.seasons_occasions so
  WHERE p.name = 'برشلونه'
    AND d.name = 'ملابس'
    AND c.name = 'رجالي'
    AND pt.name = 'تراك'
    AND so.name = 'صيفي'
)
-- ربط منتج برشلونه بالعناصر المطلوبة
INSERT INTO public.product_departments (product_id, department_id)
SELECT product_id, department_id FROM required_ids
ON CONFLICT (product_id, department_id) DO NOTHING;

WITH required_ids AS (
  SELECT 
    d.id as department_id,
    c.id as category_id,
    pt.id as product_type_id,
    so.id as season_occasion_id,
    p.id as product_id
  FROM public.products p
  CROSS JOIN public.departments d
  CROSS JOIN public.categories c  
  CROSS JOIN public.product_types pt
  CROSS JOIN public.seasons_occasions so
  WHERE p.name = 'برشلونه'
    AND d.name = 'ملابس'
    AND c.name = 'رجالي'
    AND pt.name = 'تراك'
    AND so.name = 'صيفي'
)
INSERT INTO public.product_categories (product_id, category_id)
SELECT product_id, category_id FROM required_ids
ON CONFLICT (product_id, category_id) DO NOTHING;

WITH required_ids AS (
  SELECT 
    d.id as department_id,
    c.id as category_id,
    pt.id as product_type_id,
    so.id as season_occasion_id,
    p.id as product_id
  FROM public.products p
  CROSS JOIN public.departments d
  CROSS JOIN public.categories c  
  CROSS JOIN public.product_types pt
  CROSS JOIN public.seasons_occasions so
  WHERE p.name = 'برشلونه'
    AND d.name = 'ملابس'
    AND c.name = 'رجالي'
    AND pt.name = 'تراك'
    AND so.name = 'صيفي'
)
INSERT INTO public.product_product_types (product_id, product_type_id)
SELECT product_id, product_type_id FROM required_ids
ON CONFLICT (product_id, product_type_id) DO NOTHING;

WITH required_ids AS (
  SELECT 
    d.id as department_id,
    c.id as category_id,
    pt.id as product_type_id,
    so.id as season_occasion_id,
    p.id as product_id
  FROM public.products p
  CROSS JOIN public.departments d
  CROSS JOIN public.categories c  
  CROSS JOIN public.product_types pt
  CROSS JOIN public.seasons_occasions so
  WHERE p.name = 'برشلونه'
    AND d.name = 'ملابس'
    AND c.name = 'رجالي'
    AND pt.name = 'تراك'
    AND so.name = 'صيفي'
)
INSERT INTO public.product_seasons_occasions (product_id, season_occasion_id)
SELECT product_id, season_occasion_id FROM required_ids
ON CONFLICT (product_id, season_occasion_id) DO NOTHING;