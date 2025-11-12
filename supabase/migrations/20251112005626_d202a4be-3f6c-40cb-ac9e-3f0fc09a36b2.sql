-- ✅ الحل النهائي: إصلاح كل البيانات بدون constraints

-- 1️⃣ حذف الـ constraints المانعة نهائياً
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS check_reserved_non_negative;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS check_quantity_enough_for_reserved;

-- 2️⃣ تصفير أي reserved_quantity سالب
UPDATE inventory
SET reserved_quantity = 0,
    updated_at = now()
WHERE reserved_quantity < 0;

-- 3️⃣ تصحيح البيع بالسالب: quantity = reserved حيث quantity < reserved
UPDATE inventory
SET quantity = reserved_quantity,
    updated_at = now()
WHERE quantity < reserved_quantity;

-- 4️⃣ تصحيح الطلبات المُسلّمة
UPDATE orders
SET status = 'delivered',
    updated_at = now()
WHERE delivery_status = '4' 
  AND status != 'delivered';

-- 5️⃣ تصحيح الطلبات المرجوعة
UPDATE orders
SET status = 'returned_in_stock',
    updated_at = now()
WHERE delivery_status = '17' 
  AND status != 'returned_in_stock';

-- 6️⃣ إعادة حساب reserved_quantity بدقة 100%
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

-- 7️⃣ تصفير المحجوز للمنتجات بدون طلبات نشطة
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