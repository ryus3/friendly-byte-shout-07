-- ============================================
-- تصحيح شامل: الطلب 112552848 + الطلبات المُسلّمة بـ pending items
-- ============================================

-- المرحلة 1: تصحيح الطلب 112552848 (تسليم جزئي)
-- تحديث item_status من 'returned' إلى 'returned_in_stock'
UPDATE order_items
SET item_status = 'returned_in_stock'
WHERE id = '4054f1bc-9d11-488b-a3e5-e88f58e1af13';

-- إرجاع المخزون يدوياً (ايطالي XL ازرق)
UPDATE inventory
SET 
  quantity = quantity + 1,
  reserved_quantity = GREATEST(0, reserved_quantity - 1),
  updated_at = now()
WHERE variant_id = 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72';

-- المرحلة 2: تصحيح الطلبات المُسلّمة بـ item_status='pending'
-- تحديث item_status للطلبات المُسلّمة
UPDATE order_items oi
SET item_status = 'delivered'
FROM orders o
WHERE oi.order_id = o.id
  AND o.status = 'delivered'
  AND o.delivery_status = '4'
  AND oi.item_status = 'pending'
  AND oi.variant_id = 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72';

-- تحرير المخزون المحجوز (3 قطع من الطلبات المُسلّمة)
UPDATE inventory
SET 
  reserved_quantity = GREATEST(0, reserved_quantity - 3),
  updated_at = now()
WHERE variant_id = 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72';

-- ============================================
-- التحقق النهائي الشامل
-- ============================================

-- 1. التحقق من الطلب 112552848
SELECT 
  '✅ الطلب 112552848' AS verification,
  tracking_number,
  status,
  final_amount,
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND item_status = 'returned_in_stock') AS returned_items,
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND item_status = 'delivered') AS delivered_items
FROM orders o
WHERE tracking_number = '112552848';

-- 2. التحقق من مخزون ايطالي XL ازرق
SELECT 
  '✅ مخزون ايطالي XL ازرق' AS verification,
  p.name AS product_name,
  i.quantity AS total_stock,
  i.reserved_quantity AS reserved,
  (i.quantity - i.reserved_quantity) AS available,
  CASE 
    WHEN i.reserved_quantity = 0 THEN '✅ صحيح - لا يوجد محجوز'
    ELSE '⚠️ لا يزال محجوز'
  END AS status
FROM inventory i
JOIN product_variants pv ON pv.id = i.variant_id
JOIN products p ON p.id = pv.product_id
WHERE pv.id = 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72';

-- 3. التحقق من الطلبات المُسلّمة (يجب أن تكون جميع items بحالة delivered)
SELECT 
  '✅ الطلبات المُسلّمة' AS verification,
  o.tracking_number,
  o.status,
  oi.item_status,
  p.name AS product_name,
  CASE 
    WHEN oi.item_status = 'delivered' THEN '✅ صحيح'
    ELSE '❌ خطأ - لا يزال pending'
  END AS status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN product_variants pv ON pv.id = oi.variant_id
JOIN products p ON p.id = pv.product_id
WHERE o.status = 'delivered'
  AND o.delivery_status = '4'
  AND oi.variant_id = 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72'
ORDER BY o.tracking_number;