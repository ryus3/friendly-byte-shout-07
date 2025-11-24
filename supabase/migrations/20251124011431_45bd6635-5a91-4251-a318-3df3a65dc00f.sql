-- ============================================
-- Migration: إعادة حساب شاملة لـ inventory.reserved_quantity
-- الهدف: توحيد 100% بين database و frontend
-- ============================================

-- الخطوة 1: تصفير جميع reserved_quantity مؤقتاً
UPDATE inventory
SET reserved_quantity = 0;

-- الخطوة 2: إعادة حساب الحجز من الطلبات النشطة فقط
UPDATE inventory i
SET reserved_quantity = COALESCE(sub.reserved_qty, 0)
FROM (
  SELECT
    oi.variant_id,
    SUM(oi.quantity) AS reserved_qty
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE 
    -- ✅ الطلبات النشطة فقط
    o.status IN ('pending', 'shipped', 'delivery', 'returned')
    -- ❌ استبعاد الحالات النهائية
    AND o.status NOT IN ('returned_in_stock', 'completed', 'cancelled')
    -- ❌ استبعاد العناصر المُسلّمة والمُرجعة
    AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned')
    -- ❌ استبعاد المنتجات الواردة
    AND (oi.item_direction IS NULL OR oi.item_direction <> 'incoming')
  GROUP BY oi.variant_id
) AS sub
WHERE i.variant_id = sub.variant_id;

-- الخطوة 3: ضمان عدم وجود reserved_quantity سالب
UPDATE inventory
SET reserved_quantity = GREATEST(reserved_quantity, 0);

-- الخطوة 4: التحقق النهائي - يجب أن يكون 0
DO $$
DECLARE
  count_bad_reserved INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO count_bad_reserved
  FROM order_items oi
  JOIN inventory i ON i.variant_id = oi.variant_id
  WHERE oi.item_status IN ('returned_in_stock', 'returned')
    AND i.reserved_quantity > 0;
  
  IF count_bad_reserved > 0 THEN
    RAISE WARNING 'تحذير: يوجد % عنصر returned لكن reserved_quantity > 0', count_bad_reserved;
  ELSE
    RAISE NOTICE '✅ نجح: جميع العناصر المُرجعة لها reserved_quantity = 0';
  END IF;
END $$;

-- الخطوة 5: تحديث دالة update_inventory_reserved_quantity لاستثناء returned
CREATE OR REPLACE FUNCTION update_inventory_reserved_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- إعادة حساب reserved_quantity للمنتج المتأثر
  UPDATE inventory
  SET reserved_quantity = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.variant_id = COALESCE(NEW.variant_id, OLD.variant_id)
      AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
      AND o.status NOT IN ('returned_in_stock', 'completed', 'cancelled')
      -- ✅ استثناء العناصر المُسلّمة والمُرجعة
      AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned')
      AND (oi.item_direction IS NULL OR oi.item_direction <> 'incoming')
  )
  WHERE variant_id = COALESCE(NEW.variant_id, OLD.variant_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- الخطوة 6: إعادة إنشاء trigger على order_items
DROP TRIGGER IF EXISTS update_reserved_quantity_on_item_change ON order_items;
CREATE TRIGGER update_reserved_quantity_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_reserved_quantity();

-- الخطوة 7: إضافة log للتحقق
DO $$
DECLARE
  total_reserved BIGINT;
  total_items_reserved BIGINT;
BEGIN
  SELECT SUM(reserved_quantity), COUNT(*) FILTER (WHERE reserved_quantity > 0)
  INTO total_reserved, total_items_reserved
  FROM inventory;
  
  RAISE NOTICE '📊 إحصائيات المخزون المحجوز النهائية:';
  RAISE NOTICE '  - إجمالي الكميات المحجوزة: %', total_reserved;
  RAISE NOTICE '  - عدد المنتجات المحجوزة: %', total_items_reserved;
END $$;