-- إصلاح شامل لنظام المتجر: إضافة جميع المنتجات للموظفين وتفعيل is_in_storefront

-- 1. إضافة جميع المنتجات النشطة لجميع الموظفين الذين لديهم صلاحية المتجر
INSERT INTO employee_allowed_products (employee_id, product_id, added_by, is_active, notes)
SELECT 
    p.user_id, 
    pr.id, 
    p.user_id, 
    true,
    'إضافة تلقائية - إصلاح شامل للمتجر'
FROM profiles p
CROSS JOIN products pr
WHERE p.has_storefront_access = true 
  AND pr.is_active = true
ON CONFLICT (employee_id, product_id) DO UPDATE SET is_active = true;

-- 2. إضافة وصف المنتجات للموظفين الذين ليس لديهم وصف
INSERT INTO employee_product_descriptions (employee_id, product_id, is_in_storefront, is_featured, display_order)
SELECT 
    eap.employee_id,
    eap.product_id,
    true,
    false,
    ROW_NUMBER() OVER (PARTITION BY eap.employee_id ORDER BY eap.added_at)
FROM employee_allowed_products eap
WHERE eap.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM employee_product_descriptions epd 
    WHERE epd.employee_id = eap.employee_id 
      AND epd.product_id = eap.product_id
  )
ON CONFLICT (employee_id, product_id) DO NOTHING;

-- 3. تفعيل is_in_storefront لجميع المنتجات الموجودة
UPDATE employee_product_descriptions 
SET is_in_storefront = true 
WHERE is_in_storefront = false OR is_in_storefront IS NULL;

-- 4. تحديث 3 منتجات عشوائية كمميزة لكل موظف
WITH featured_products AS (
  SELECT 
    employee_id, 
    product_id,
    ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY RANDOM()) as rn
  FROM employee_product_descriptions
  WHERE is_in_storefront = true
)
UPDATE employee_product_descriptions epd
SET is_featured = true
FROM featured_products fp
WHERE epd.employee_id = fp.employee_id 
  AND epd.product_id = fp.product_id
  AND fp.rn <= 3;

-- 5. التأكد من تفعيل المتاجر
UPDATE employee_storefront_settings 
SET is_active = true 
WHERE is_active = false OR is_active IS NULL;