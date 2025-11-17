-- ✅ توحيد نظام الحجز النهائي: returned تحجز + استثناء item_status='delivered'

-- تحديث trigger لحجز المخزون الصحيح
CREATE OR REPLACE FUNCTION update_inventory_reserved_quantity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET reserved_quantity = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.variant_id = inventory.variant_id
      AND o.order_type != 'return'
      -- ✅ احجز: pending, shipped, delivery, returned
      AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
      -- ❌ لا تحجز: completed (4) أو returned_in_stock (17)
      AND o.status NOT IN ('completed', 'returned_in_stock')
      -- ❌ لا تحجز: المنتجات المُسلّمة في التسليم الجزئي (21)
      AND (oi.item_status IS NULL OR oi.item_status != 'delivered')
      -- ❌ لا تحجز: المنتجات الواردة
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  ),
  updated_at = now()
  WHERE variant_id IN (
    SELECT DISTINCT oi.variant_id 
    FROM order_items oi
    WHERE oi.order_id IN (NEW.id, COALESCE(OLD.id, NEW.id))
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة حساب المحجوز لجميع المنتجات
UPDATE inventory
SET reserved_quantity = (
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = inventory.variant_id
    AND o.order_type != 'return'
    AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
    AND o.status NOT IN ('completed', 'returned_in_stock')
    AND (oi.item_status IS NULL OR oi.item_status != 'delivered')
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
),
updated_at = now();