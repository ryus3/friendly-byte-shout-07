-- ============================================
-- تصحيح شامل للطلب 112066293 (تسليم جزئي)
-- ============================================

-- المرحلة 1: تصحيح final_amount من 38,000 إلى 33,000
UPDATE orders
SET final_amount = 33000
WHERE tracking_number = '112066293';

-- المرحلة 2: إصلاح item_status وإرجاع المخزون لايطالي L
-- تصحيح item_status
UPDATE order_items
SET item_status = 'returned_in_stock'
WHERE id = 'd556a421-0336-44da-84a1-ef569bdcfedf';

-- إرجاع المخزون يدوياً (ايطالي L)
UPDATE inventory
SET 
  quantity = quantity + 1,
  reserved_quantity = GREATEST(0, reserved_quantity - 1),
  updated_at = now()
WHERE variant_id = '63dc7e67-80a1-452c-845f-d3696493b0eb';

-- ============================================
-- التحقق النهائي
-- ============================================
SELECT 
  'الطلب 112066293' AS verification,
  tracking_number,
  final_amount,
  CASE WHEN final_amount = 33000 THEN '✅ صحيح' ELSE '❌ خطأ' END AS status
FROM orders
WHERE tracking_number = '112066293';

SELECT 
  'مخزون ايطالي L' AS verification,
  p.name AS product_name,
  i.quantity,
  i.reserved_quantity,
  (i.quantity - i.reserved_quantity) AS available
FROM inventory i
JOIN product_variants pv ON pv.id = i.variant_id
JOIN products p ON p.id = pv.product_id
WHERE pv.id = '63dc7e67-80a1-452c-845f-d3696493b0eb';