-- ✅ إعادة حساب المخزون المحجوز بدقة 100% + إصلاح البيع بالسالب

-- 1️⃣ إعادة حساب reserved_quantity بدقة 100% من الطلبات النشطة
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
SET reserved_quantity = COALESCE(ar.total_reserved, 0),
    updated_at = now()
FROM active_reservations ar
WHERE inventory.variant_id = ar.variant_id;

-- 2️⃣ تصفير المحجوز للمنتجات بدون طلبات نشطة
UPDATE inventory
SET reserved_quantity = 0,
    updated_at = now()
WHERE variant_id NOT IN (
  SELECT DISTINCT oi.variant_id
  FROM order_items oi
  INNER JOIN orders o ON oi.order_id = o.id
  WHERE o.status IN ('pending', 'shipped', 'in_delivery', 'returned')
    AND o.order_type != 'return'
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
)
AND reserved_quantity > 0;

-- 3️⃣ إصلاح منتج "سوت شيك L جوزي" - البيع بالسالب
UPDATE inventory
SET quantity = reserved_quantity,
    updated_at = now()
WHERE variant_id = '2d57c374-bae7-4bdd-b7b2-d0e36c6ea61e'
  AND quantity < reserved_quantity;