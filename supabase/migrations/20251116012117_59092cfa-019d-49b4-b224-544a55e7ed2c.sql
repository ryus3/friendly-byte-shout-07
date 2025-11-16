-- ============================================
-- المرحلة 1: إصلاح نظام الحجز - Trigger محدث
-- ============================================

-- حذف الـ Trigger القديم
DROP TRIGGER IF EXISTS update_inventory_reserved_on_order_change ON orders;
DROP TRIGGER IF EXISTS update_inventory_reserved_on_item_change ON order_items;

-- إعادة بناء Function لحساب الحجز بشكل صحيح
CREATE OR REPLACE FUNCTION update_inventory_reserved_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث reserved_quantity لكل variant متأثر
  UPDATE inventory
  SET reserved_quantity = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.variant_id = inventory.variant_id
      AND o.order_type != 'return'
      AND o.status IN ('pending', 'shipped', 'delivery')  -- ✅ فقط الحالات النشطة
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

-- إعادة إنشاء Triggers
CREATE TRIGGER update_inventory_reserved_on_order_change
  AFTER INSERT OR UPDATE OF status, delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_reserved_quantity();

CREATE TRIGGER update_inventory_reserved_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_reserved_quantity();

-- ============================================
-- المرحلة 2: إصلاح الطلبات المسلمة
-- ============================================

-- تحديث جميع الطلبات المسلمة (delivery_status = 4) إلى completed
UPDATE orders
SET 
  status = 'completed',
  updated_at = now()
WHERE delivery_status = '4'
  AND status = 'delivered'
  AND (receipt_received = true OR delivery_partner_invoice_id IS NOT NULL);

-- ============================================
-- المرحلة 3: إعادة حساب الحجز لكل المخزون
-- ============================================

-- إعادة حساب reserved_quantity لكل inventory
UPDATE inventory
SET reserved_quantity = (
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = inventory.variant_id
    AND o.order_type != 'return'
    AND o.status IN ('pending', 'shipped', 'delivery')  -- ✅ فقط الحالات النشطة
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
),
updated_at = now();