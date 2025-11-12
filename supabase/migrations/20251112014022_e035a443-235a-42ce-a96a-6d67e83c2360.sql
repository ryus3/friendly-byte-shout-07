-- ✅ إصلاح نهائي دقيق 100%: تصحيح reserved_quantity في جدول inventory

-- 1️⃣ تصفير كل المحجوز أولاً
UPDATE inventory 
SET reserved_quantity = 0,
    updated_at = now();

-- 2️⃣ إعادة حساب دقيقة 100% من الطلبات النشطة
WITH active_reservations AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_reserved
  FROM order_items oi
  INNER JOIN orders o ON oi.order_id = o.id
  WHERE o.status IN ('pending', 'shipped', 'in_delivery', 'returned')
    AND o.order_type != 'return'
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
  GROUP BY oi.variant_id
)
UPDATE inventory
SET reserved_quantity = ar.total_reserved,
    updated_at = now()
FROM active_reservations ar
WHERE inventory.variant_id = ar.variant_id;

-- 3️⃣ التحقق النهائي: عدد المنتجات المحجوزة
SELECT COUNT(*) as reserved_products_count
FROM inventory
WHERE reserved_quantity > 0;