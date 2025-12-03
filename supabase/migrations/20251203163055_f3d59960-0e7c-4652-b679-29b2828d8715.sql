-- ============================================
-- الإصلاح الجذري الشامل للمخزون المحجوز
-- القاعدة الذهبية: delivery_status NOT IN ('4', '17') = محجوز
-- ============================================

-- 1. تصحيح الطلبات المرفوضة (31/32) من cancelled إلى returned
UPDATE orders 
SET status = 'returned',
    updated_at = NOW()
WHERE delivery_status IN ('31', '32') 
  AND status = 'cancelled'
  AND (isarchived IS NULL OR isarchived = false);

-- 2. تصفير جميع reserved_quantity
UPDATE inventory SET reserved_quantity = 0;

-- 3. إعادة حساب المحجوز بالقاعدة الذهبية
WITH active_reservations AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_reserved
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE (o.isarchived IS NULL OR o.isarchived = false)
    AND (o.delivery_status IS NULL OR o.delivery_status NOT IN ('4', '17'))
    AND (o.order_type IS NULL OR o.order_type NOT IN ('return'))
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
    AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock'))
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET reserved_quantity = COALESCE(ar.total_reserved, 0)
FROM active_reservations ar
WHERE i.variant_id = ar.variant_id;

-- 4. تحديث دالة update_order_reservation_status
CREATE OR REPLACE FUNCTION update_order_reservation_status()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ القاعدة الذهبية: فقط delivery_status = '4' أو '17' تحرر المخزون
  IF NEW.delivery_status IN ('4', '17') THEN
    -- تحرير المخزون للمنتجات الصادرة
    UPDATE inventory i
    SET reserved_quantity = GREATEST(0, i.reserved_quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.variant_id = oi.variant_id
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
      AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock'));
      
    -- تحديث item_status بناءً على delivery_status
    IF NEW.delivery_status = '4' THEN
      UPDATE order_items SET item_status = 'delivered' WHERE order_id = NEW.id AND (item_direction IS NULL OR item_direction != 'incoming');
    ELSIF NEW.delivery_status = '17' THEN
      UPDATE order_items SET item_status = 'returned_in_stock' WHERE order_id = NEW.id AND (item_direction IS NULL OR item_direction != 'incoming');
    END IF;
  END IF;
  
  -- ✅ إذا تم أرشفة الطلب، تحرير المخزون أيضاً
  IF NEW.isarchived = true AND (OLD.isarchived IS NULL OR OLD.isarchived = false) THEN
    UPDATE inventory i
    SET reserved_quantity = GREATEST(0, i.reserved_quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.variant_id = oi.variant_id
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
      AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock'));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. إضافة تعليق توضيحي
COMMENT ON FUNCTION update_order_reservation_status() IS 
'القاعدة الذهبية: المخزون يُحرر فقط عند delivery_status = 4 (مباع) أو 17 (رجع للمخزون) أو أرشفة الطلب. 
جميع الحالات الأخرى (pending, shipped, delivery, returned, partial_delivery, cancelled) تبقى محجوزة.';