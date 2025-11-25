-- ✅ الخطة الشاملة لإصلاح نظام المخزون المحجوز نهائياً - مع تصحيح المخزون
-- Comprehensive Inventory Reserved Quantity Fix Plan - With Stock Correction

-- ======================================
-- المرحلة 0: تصحيح المخزون للمنتجات المشكلة
-- ======================================
-- إضافة 3 قطع لـ "ارجنتين شتوي S" لتغطية الطلبات النشطة
UPDATE inventory
SET quantity = quantity + 3,
    updated_at = now()
WHERE variant_id = '7484a597-902d-42b7-b6bc-b0e2f5fab0fa';

-- ======================================
-- المرحلة 1: حذف السجل المكرر
-- ======================================
DELETE FROM order_items 
WHERE id = '5037cb45-c6b9-4c86-b385-84f1134cc0c4';

-- ======================================
-- المرحلة 2: إصلاح دالة update_inventory_reserved_quantity
-- ======================================
DROP FUNCTION IF EXISTS update_inventory_reserved_quantity() CASCADE;

CREATE OR REPLACE FUNCTION update_inventory_reserved_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE inventory
  SET reserved_quantity = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.variant_id = COALESCE(NEW.variant_id, OLD.variant_id)
      AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
      AND o.status NOT IN ('returned_in_stock', 'completed', 'cancelled')
      AND o.isarchived = false
      AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned')
      AND (oi.item_direction IS NULL OR oi.item_direction <> 'incoming')
  ),
  updated_at = now()
  WHERE variant_id = COALESCE(NEW.variant_id, OLD.variant_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- إعادة إنشاء triggers على order_items
DROP TRIGGER IF EXISTS update_reserved_on_order_item_change ON order_items;

CREATE TRIGGER update_reserved_on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_reserved_quantity();

COMMENT ON FUNCTION update_inventory_reserved_quantity() IS 
'✅ محدّثة: تشمل isarchived=false لمنع احتساب الطلبات المؤرشفة';

-- ======================================
-- المرحلة 3: إنشاء Trigger على orders لتحديث reserved_quantity
-- ======================================
DROP FUNCTION IF EXISTS update_all_items_reserved_on_order_status_change() CASCADE;

CREATE OR REPLACE FUNCTION update_all_items_reserved_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- تحديث reserved_quantity فقط عند تغيير status أو isarchived
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.isarchived IS DISTINCT FROM NEW.isarchived THEN
    UPDATE inventory i
    SET reserved_quantity = (
      SELECT COALESCE(SUM(oi2.quantity), 0)
      FROM orders o
      JOIN order_items oi2 ON oi2.order_id = o.id
      WHERE oi2.variant_id = i.variant_id
        AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
        AND o.status NOT IN ('returned_in_stock', 'completed', 'cancelled')
        AND o.isarchived = false
        AND oi2.item_status NOT IN ('delivered', 'returned_in_stock', 'returned')
        AND (oi2.item_direction IS NULL OR oi2.item_direction <> 'incoming')
    ),
    updated_at = now()
    WHERE i.variant_id IN (
      SELECT variant_id FROM order_items WHERE order_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_reserved_on_order_status_change ON orders;

CREATE TRIGGER update_reserved_on_order_status_change
AFTER UPDATE OF status, isarchived ON orders
FOR EACH ROW
EXECUTE FUNCTION update_all_items_reserved_on_order_status_change();

COMMENT ON FUNCTION update_all_items_reserved_on_order_status_change() IS 
'✅ جديد: trigger يُحدّث reserved_quantity تلقائياً عند تغيير status أو isarchived';

-- ======================================
-- المرحلة 4: إعادة حساب شاملة لجميع reserved_quantity
-- ======================================
UPDATE inventory i
SET reserved_quantity = (
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE oi.variant_id = i.variant_id
    AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
    AND o.status NOT IN ('returned_in_stock', 'completed', 'cancelled')
    AND o.isarchived = false
    AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned')
    AND (oi.item_direction IS NULL OR oi.item_direction <> 'incoming')
),
updated_at = now();

-- ======================================
-- المرحلة 5: إضافة UNIQUE constraint لمنع التكرار مستقبلاً
-- ======================================
DROP INDEX IF EXISTS unique_order_item_variant;

CREATE UNIQUE INDEX unique_order_item_variant 
ON order_items (order_id, variant_id) 
WHERE item_direction IS NULL OR item_direction != 'incoming';

COMMENT ON INDEX unique_order_item_variant IS 
'✅ يمنع تكرار نفس المنتج في طلب واحد (باستثناء incoming items)';

-- ======================================
-- المرحلة 6: إصلاح دالة handle_order_status_change
-- ======================================
DROP FUNCTION IF EXISTS handle_order_status_change() CASCADE;

CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ✅ حالة completed: تقليل المخزون (المنتجات تُعتبر مباع)
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE inventory i
    SET quantity = GREATEST(0, i.quantity - oi.quantity),
        updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variant_id = i.variant_id
      AND oi.item_status NOT IN ('returned_in_stock', 'returned')
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
  END IF;

  -- ✅ حالة returned_in_stock: إرجاع للمخزون الفعلي
  IF NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock' THEN
    UPDATE inventory i
    SET quantity = i.quantity + oi.quantity,
        updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variant_id = i.variant_id
      AND oi.item_status = 'returned_in_stock'
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handle_order_status_change ON orders;

CREATE TRIGGER trigger_handle_order_status_change
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_status_change();

COMMENT ON FUNCTION handle_order_status_change() IS 
'✅ محدّثة: تُدير حالة completed (مباع) و returned_in_stock (إرجاع للمخزون) بشكل صحيح';