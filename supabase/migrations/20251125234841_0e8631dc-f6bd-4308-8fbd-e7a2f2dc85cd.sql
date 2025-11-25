
-- ==========================================
-- الإصلاح الشامل: تعديل handle_order_status_change + تصحيح البيانات
-- ==========================================

-- المرحلة 1: تصحيح المخزون للطلبات المتأثرة (3 طلبات delivered مع item_status=pending)
-- ==========================================

-- الطلب 113591250: ارجنتين شتوي XXL (تخفيض من 2 إلى 1)
UPDATE inventory
SET quantity = quantity - 1,
    updated_at = now()
WHERE variant_id = '1633269e-5280-447f-acda-c877eaed7796'
  AND quantity >= 1;

-- الطلب 113256936: ايطالي ازرق M (تخفيض من 13 إلى 12)
UPDATE inventory
SET quantity = quantity - 1,
    updated_at = now()
WHERE variant_id = 'c78a4ec6-59b8-4e27-81a7-c89f44d4f02f'
  AND quantity >= 1;

-- الطلب 113138197: ايطالي ابيض XXL (تخفيض من 16 إلى 15)
UPDATE inventory
SET quantity = quantity - 1,
    updated_at = now()
WHERE variant_id = 'fd18355e-3596-41d1-8620-8d5990ba362d'
  AND quantity >= 1;

-- المرحلة 2: تحديث item_status من pending إلى delivered للطلبات المتأثرة
-- ==========================================

UPDATE order_items
SET item_status = 'delivered'
WHERE order_id IN (
  '82c4ad41-3bf9-452d-a432-24105116d783',  -- 113591250
  '330b3500-4e92-48b0-8a4b-caddbc118298',  -- 113256936
  '259d0fdf-e9f8-4db9-b874-c1528cf19ca3'   -- 113138197
)
AND item_status = 'pending';

-- المرحلة 3: إعادة إنشاء دالة handle_order_status_change مع الكود الصحيح
-- ==========================================

DROP FUNCTION IF EXISTS handle_order_status_change() CASCADE;

CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عندما تصبح حالة الطلب "delivered" (حالة 4)
  -- المحجوز يتحول إلى مباع (تخفيض quantity)
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- تقليل المخزون (المنتجات تُعتبر مباع)
    UPDATE inventory i
    SET quantity = GREATEST(0, i.quantity - oi.quantity),
        updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variant_id = i.variant_id
      AND oi.item_status NOT IN ('returned_in_stock', 'returned', 'delivered')
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
    
    -- تحديث item_status إلى delivered
    UPDATE order_items
    SET item_status = 'delivered'
    WHERE order_id = NEW.id
      AND item_status = 'pending';
  END IF;

  -- عندما تصبح حالة الطلب "returned_in_stock" أو item_status يتغير
  -- المحجوز يعود إلى المخزون الفعلي (زيادة quantity)
  IF EXISTS (
    SELECT 1 FROM order_items 
    WHERE order_id = NEW.id 
      AND item_status = 'returned_in_stock'
  ) THEN
    -- إعادة المنتجات المُرجعة إلى المخزون
    UPDATE inventory i
    SET quantity = i.quantity + oi.quantity,
        updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variant_id = i.variant_id
      AND oi.item_status = 'returned_in_stock';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_order_status_change() IS 'تحديث المخزون تلقائياً عند تغيير حالة الطلب - delivered = مباع، returned_in_stock = إعادة للمخزون';

-- إعادة إنشاء Trigger
DROP TRIGGER IF EXISTS trigger_handle_order_status_change ON orders;

CREATE TRIGGER trigger_handle_order_status_change
  AFTER UPDATE OF status
  ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_order_status_change();

-- المرحلة 4: التحقق من النتائج
-- ==========================================

-- عرض النتائج بعد التصحيح
DO $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE '=== نتائج الإصلاح الشامل ===';
  
  FOR v_result IN 
    SELECT 
      pv.sku,
      p.name as product_name,
      c.name as color_name,
      s.name as size_name,
      i.quantity as stock_after_fix,
      i.reserved_quantity as reserved_after_fix,
      (i.quantity - i.reserved_quantity) as available_after_fix
    FROM inventory i
    JOIN product_variants pv ON pv.id = i.variant_id
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN colors c ON c.id = pv.color_id
    LEFT JOIN sizes s ON s.id = pv.size_id
    WHERE i.variant_id IN (
      '1633269e-5280-447f-acda-c877eaed7796',
      'c78a4ec6-59b8-4e27-81a7-c89f44d4f02f',
      'fd18355e-3596-41d1-8620-8d5990ba362d'
    )
    ORDER BY p.name, s.name
  LOOP
    RAISE NOTICE '✅ %: مخزون=% | محجوز=% | متاح=%',
      v_result.product_name || ' ' || COALESCE(v_result.color_name, '') || ' ' || COALESCE(v_result.size_name, ''),
      v_result.stock_after_fix,
      v_result.reserved_after_fix,
      v_result.available_after_fix;
  END LOOP;
  
  RAISE NOTICE '=== تم الإصلاح الشامل بنجاح ===';
END $$;
