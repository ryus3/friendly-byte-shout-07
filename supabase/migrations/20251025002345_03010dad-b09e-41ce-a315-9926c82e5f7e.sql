-- تصحيح reserved_quantity للمنتجات المحجوزة خطأً بشكل مزدوج
-- هذا التصحيح يحسب الكمية الفعلية المحجوزة من order_items النشطة فقط

UPDATE inventory
SET reserved_quantity = (
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = inventory.variant_id
    AND o.status IN ('pending', 'shipped', 'delivery')
    AND (oi.item_direction IS NULL OR oi.item_direction = 'outgoing')
)
WHERE reserved_quantity > 0;