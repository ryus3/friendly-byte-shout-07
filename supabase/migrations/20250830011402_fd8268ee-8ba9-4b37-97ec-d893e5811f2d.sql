-- خطة الإصلاح: إزالة الربط الخاطئ لمنتج Barcelona مع فئة "تراك"، وربطه بفئة "رجالي" إن وُجدت،
-- ثم حذف الإدخالات الخاطئة غير المستخدمة فقط (لا نحذف أي عنصر مستخدم).

-- 1) إصلاح ربط منتج Barcelona
-- إزالة ربط "تراك" لأي منتج اسمه يحوي Barcelona / برشلونة
DELETE FROM public.product_categories pc
USING public.products p, public.categories c
WHERE pc.product_id = p.id
  AND pc.category_id = c.id
  AND c.name = 'تراك'
  AND (p.name ILIKE '%barcelona%' OR p.name ILIKE '%برشلونة%');

-- إضافة ربط بفئة "رجالي" إذا كانت موجودة كفئة، دون إنشاء فئة جديدة
INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, c.id
FROM public.products p
JOIN public.categories c ON c.name = 'رجالي'
WHERE (p.name ILIKE '%barcelona%' OR p.name ILIKE '%برشلونة%')
  AND NOT EXISTS (
    SELECT 1 FROM public.product_categories pc
    WHERE pc.product_id = p.id AND pc.category_id = c.id
  );

-- 2) حذف الإدخالات الخاطئة غير المستخدمة فقط
-- ملاحظة: نحذف فقط إن كانت غير مُستخدمة بأي منتج

-- حذف فئات بأسماء محددة إذا كانت غير مستخدمة
WITH target_cats AS (
  SELECT id, name FROM public.categories WHERE name IN ('ملابس','صيفي','تراك')
), used_cats AS (
  SELECT DISTINCT category_id FROM public.product_categories
  WHERE category_id IN (SELECT id FROM target_cats)
)
DELETE FROM public.categories
WHERE id IN (
  SELECT id FROM target_cats
  EXCEPT
  SELECT category_id FROM used_cats
);

-- حذف قسم باسم "رجالي" إذا كان غير مستخدم
WITH target_deps AS (
  SELECT id FROM public.departments WHERE name = 'رجالي'
), used_deps AS (
  SELECT DISTINCT department_id FROM public.product_departments
  WHERE department_id IN (SELECT id FROM target_deps)
)
DELETE FROM public.departments
WHERE id IN (
  SELECT id FROM target_deps
  EXCEPT
  SELECT department_id FROM used_deps
);

-- حذف نوع منتج باسم "ملابس" إذا كان غير مستخدم
-- نفترض وجود جدول public.product_types وجدول ربط public.product_product_types
WITH target_pts AS (
  SELECT id FROM public.product_types WHERE name IN ('ملابس')
), used_pts AS (
  SELECT DISTINCT product_type_id FROM public.product_product_types
  WHERE product_type_id IN (SELECT id FROM target_pts)
)
DELETE FROM public.product_types
WHERE id IN (
  SELECT id FROM target_pts
  EXCEPT
  SELECT product_type_id FROM used_pts
);
