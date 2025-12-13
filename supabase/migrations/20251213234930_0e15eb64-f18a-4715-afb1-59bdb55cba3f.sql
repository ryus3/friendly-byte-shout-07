-- ============================================
-- خطة الإصلاح الشاملة للمخزون
-- ============================================

-- 1) تصحيح مخزون ترانش طويل - بيجي (41 → 39)
UPDATE inventory 
SET quantity = 39
WHERE variant_id = (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  JOIN colors c ON pv.color_id = c.id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'بيجي'
  LIMIT 1
);

-- تسجيل عملية التصحيح - بيجي
INSERT INTO inventory_operations_log (
  variant_id, product_name, color_name, size_value,
  operation_type, source_type, quantity_change,
  quantity_before, quantity_after,
  reserved_before, reserved_after,
  sold_before, sold_after,
  notes, performed_by
)
SELECT 
  pv.id,
  p.name,
  c.name,
  COALESCE(s.name, 'افتراضي'),
  'audit_correction',
  'audit',
  -2,
  41, 39,
  COALESCE(i.reserved_quantity, 0), COALESCE(i.reserved_quantity, 0),
  COALESCE(i.sold_quantity, 0), COALESCE(i.sold_quantity, 0),
  'تصحيح فحص دقة المخزون: إزالة الزيادة الخاطئة من عملية stock_added السابقة',
  NULL
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
JOIN colors c ON pv.color_id = c.id
LEFT JOIN sizes s ON pv.size_id = s.id
LEFT JOIN inventory i ON i.variant_id = pv.id
WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'بيجي'
LIMIT 1;

-- 2) تصحيح مخزون ترانش طويل - رصاصي (42 → 41)
UPDATE inventory 
SET quantity = 41
WHERE variant_id = (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  JOIN colors c ON pv.color_id = c.id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'رصاصي'
  LIMIT 1
);

-- تسجيل عملية التصحيح - رصاصي
INSERT INTO inventory_operations_log (
  variant_id, product_name, color_name, size_value,
  operation_type, source_type, quantity_change,
  quantity_before, quantity_after,
  reserved_before, reserved_after,
  sold_before, sold_after,
  notes, performed_by
)
SELECT 
  pv.id,
  p.name,
  c.name,
  COALESCE(s.name, 'افتراضي'),
  'audit_correction',
  'audit',
  -1,
  42, 41,
  COALESCE(i.reserved_quantity, 0), COALESCE(i.reserved_quantity, 0),
  COALESCE(i.sold_quantity, 0), COALESCE(i.sold_quantity, 0),
  'تصحيح فحص دقة المخزون: إزالة الزيادة الخاطئة من عملية stock_added السابقة',
  NULL
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
JOIN colors c ON pv.color_id = c.id
LEFT JOIN sizes s ON pv.size_id = s.id
LEFT JOIN inventory i ON i.variant_id = pv.id
WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'رصاصي'
LIMIT 1;

-- 3) إصلاح المحجوز المفقود لـ ارجنتين ش (pending_return من التسليم الجزئي)
UPDATE inventory 
SET reserved_quantity = reserved_quantity + 1
WHERE variant_id = 'f0be2356-802a-45a9-8b54-f6f8e2705048';

-- تسجيل عملية التصحيح - المحجوز
INSERT INTO inventory_operations_log (
  variant_id, product_name, color_name, size_value,
  operation_type, source_type, quantity_change,
  quantity_before, quantity_after,
  reserved_before, reserved_after,
  sold_before, sold_after,
  notes, performed_by
)
SELECT 
  pv.id,
  p.name,
  COALESCE(c.name, 'افتراضي'),
  COALESCE(s.name, 'افتراضي'),
  'audit_correction',
  'audit',
  0,
  COALESCE(i.quantity, 0), COALESCE(i.quantity, 0),
  COALESCE(i.reserved_quantity, 0) - 1, COALESCE(i.reserved_quantity, 0),
  COALESCE(i.sold_quantity, 0), COALESCE(i.sold_quantity, 0),
  'تصحيح فحص دقة المخزون: إضافة المحجوز المفقود من التسليم الجزئي (item_status=pending_return)',
  NULL
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
LEFT JOIN colors c ON pv.color_id = c.id
LEFT JOIN sizes s ON pv.size_id = s.id
LEFT JOIN inventory i ON i.variant_id = pv.id
WHERE pv.id = 'f0be2356-802a-45a9-8b54-f6f8e2705048';

-- 4) تصحيح المباع الخاطئ للمنتجات المكتشفة
-- ارجنتين سمائي: من 3 إلى 1
UPDATE inventory SET sold_quantity = 1 WHERE variant_id = 'ea8aa124-9e18-4318-a3ae-3eafb76f3e2f';

-- ارجنتين ش افتراضي (7484a597): من 21 إلى 20
UPDATE inventory SET sold_quantity = 20 WHERE variant_id = '7484a597-cafd-46af-a3b1-a82d30be97a9';

-- سوت شيك جوزي: من 1 إلى 0 لكل variants
UPDATE inventory SET sold_quantity = 0 
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.name LIKE '%سوت شيك%'
);