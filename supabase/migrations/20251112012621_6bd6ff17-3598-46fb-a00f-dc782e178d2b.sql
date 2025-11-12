-- ✅ الخطة الكاملة: إصلاح الطلبات المُسلّمة + الطلبات المحلية المكتملة + إعادة حساب المخزون المحجوز بدقة 100%

-- 1️⃣ إصلاح 7 طلبات: delivery_status='4' → status='delivered'
UPDATE orders
SET status = 'delivered',
    updated_at = now()
WHERE delivery_status = '4'
  AND status != 'delivered'
  AND status != 'completed';

-- 2️⃣ إصلاح 4 طلبات محلية: receipt_received=true → status='completed'
UPDATE orders
SET status = 'completed',
    updated_at = now()
WHERE tracking_number IN ('RYUS-059177', 'RYUS-042031', 'RYUS-299923', 'RYUS-415487')
  AND receipt_received = true
  AND delivery_partner = 'محلي'
  AND status != 'completed';

-- 3️⃣ إعادة حساب reserved_quantity بدقة 100% من الطلبات النشطة
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

-- 4️⃣ تصفير المحجوز للمنتجات بدون طلبات نشطة
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