-- ============================================
-- إصلاح جذري للمخزون المحجوز
-- ============================================

-- 1. حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS update_order_reservation_status(UUID, TEXT, TEXT, TEXT);

-- 2. إنشاء الدالة الجديدة - بدون حجز مكرر
CREATE OR REPLACE FUNCTION update_order_reservation_status(
  p_order_id UUID,
  p_status TEXT,
  p_delivery_status TEXT,
  p_delivery_partner TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_release BOOLEAN;
  should_keep BOOLEAN;
  action_performed TEXT := 'none';
  result JSONB;
BEGIN
  -- تحديد ما إذا كان يجب تحرير المخزون
  should_release := (
    p_status IN ('delivered', 'completed', 'returned_in_stock', 'cancelled') OR
    p_delivery_status IN ('4', '17')
  );
  
  -- تحديد ما إذا كان الحجز يجب أن يبقى
  should_keep := (
    p_status IN ('pending', 'shipped', 'delivery', 'returned') AND
    p_status NOT IN ('delivered', 'completed', 'returned_in_stock', 'cancelled') AND
    p_delivery_status NOT IN ('4', '17')
  );

  IF should_release THEN
    -- تحرير المخزون عند حالة 4 (delivered) أو 17 (returned) أو الحالات النهائية
    PERFORM release_stock_for_order(p_order_id);
    action_performed := 'stock_released';
    
  ELSIF should_keep THEN
    -- ✅ الحجز موجود بالفعل من إنشاء الطلب - لا نُضيف حجز مكرر!
    action_performed := 'reservation_kept_no_action';
  END IF;

  result := jsonb_build_object(
    'order_id', p_order_id,
    'status', p_status,
    'delivery_status', p_delivery_status,
    'should_release', should_release,
    'should_keep', should_keep,
    'action_performed', action_performed
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION update_order_reservation_status IS 'الحجز يتم مرة واحدة فقط عند إنشاء الطلب - هذه الدالة فقط تُحرر المخزون عند الحالات النهائية';

-- 3. تصفير جميع reserved_quantity
UPDATE inventory SET reserved_quantity = 0;

-- 4. إعادة حساب المحجوز من الطلبات النشطة فقط
WITH active_reservations AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_reserved
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE 
    o.status IN ('pending', 'shipped', 'delivery', 'returned')
    AND o.status NOT IN ('delivered', 'completed', 'returned_in_stock', 'cancelled')
    AND (o.order_type IS NULL OR o.order_type != 'return')
    AND (o.isarchived IS NULL OR o.isarchived = false)
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
    AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock'))
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET reserved_quantity = ar.total_reserved
FROM active_reservations ar
WHERE i.variant_id = ar.variant_id;

-- 5. التأكد من عدم وجود قيم سالبة
UPDATE inventory SET reserved_quantity = 0 WHERE reserved_quantity < 0;