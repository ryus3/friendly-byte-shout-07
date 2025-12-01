-- تصفير كل reserved_quantity أولاً
UPDATE inventory SET reserved_quantity = 0;

-- إعادة الحساب من الطلبات النشطة فقط
-- استثناء: delivery_status IN (4, 17, 31) أو status = completed/delivered/cancelled
WITH active_reservations AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as reserved_qty
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE o.isarchived = false
  AND o.status NOT IN ('delivered', 'completed', 'returned_in_stock', 'cancelled')
  AND o.delivery_status NOT IN ('4', '17', '31')
  AND (o.order_type IS NULL OR o.order_type != 'return')
  AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned'))
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET reserved_quantity = ar.reserved_qty
FROM active_reservations ar
WHERE i.variant_id = ar.variant_id;