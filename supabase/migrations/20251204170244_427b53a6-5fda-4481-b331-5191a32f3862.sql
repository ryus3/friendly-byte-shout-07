-- =============================================
-- مزامنة حقل sold_quantity تلقائياً
-- =============================================

-- 1. تعديل دالة handle_order_status_change لتحديث sold_quantity عند التسليم
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند التسليم للزبون (delivery_status = '4')
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    -- تحديث المخزون: إنقاص الكمية وزيادة المباع
    UPDATE inventory i
    SET 
      quantity = GREATEST(0, i.quantity - oi.quantity),
      sold_quantity = COALESCE(i.sold_quantity, 0) + oi.quantity,
      updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.variant_id = oi.variant_id
      AND NEW.order_type IS DISTINCT FROM 'return'
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
    
    -- تسجيل العملية في السجل
    INSERT INTO inventory_operations_log (
      variant_id, product_id, operation_type, quantity_change,
      source_type, order_id, tracking_number, notes, performed_at
    )
    SELECT 
      oi.variant_id, oi.product_id, 'sold', oi.quantity,
      'order', NEW.id, NEW.tracking_number, 
      'تسليم طلب - delivery_status=4', now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND NEW.order_type IS DISTINCT FROM 'return'
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
  END IF;

  -- عند إرجاع الطلب للتاجر (delivery_status = '17')
  IF NEW.delivery_status = '17' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '17') THEN
    -- تحرير المحجوز فقط (المتاح يزداد)
    UPDATE inventory i
    SET 
      reserved_quantity = GREATEST(0, i.reserved_quantity - oi.quantity),
      updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.variant_id = oi.variant_id
      AND NEW.order_type IS DISTINCT FROM 'return'
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
    
    -- تسجيل العملية
    INSERT INTO inventory_operations_log (
      variant_id, product_id, operation_type, quantity_change,
      source_type, order_id, tracking_number, notes, performed_at
    )
    SELECT 
      oi.variant_id, oi.product_id, 'released', oi.quantity,
      'return', NEW.id, NEW.tracking_number, 
      'إرجاع للتاجر - delivery_status=17', now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND NEW.order_type IS DISTINCT FROM 'return'
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming');
  END IF;

  RETURN NEW;
END;
$$;

-- 2. التأكد من وجود الـ trigger
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;
CREATE TRIGGER trg_handle_order_status_change
  AFTER UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_change();

-- 3. مزامنة البيانات التاريخية - تحديث sold_quantity لجميع الطلبات المسلمة
WITH calculated_sold AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_sold
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE o.delivery_status = '4'
    AND o.order_type IS DISTINCT FROM 'return'
    AND o.isarchived IS NOT TRUE
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET 
  sold_quantity = COALESCE(cs.total_sold, 0),
  updated_at = now()
FROM calculated_sold cs
WHERE i.variant_id = cs.variant_id;

-- 4. تصفير sold_quantity للمنتجات التي ليس لها مبيعات
UPDATE inventory i
SET sold_quantity = 0, updated_at = now()
WHERE i.variant_id NOT IN (
  SELECT DISTINCT oi.variant_id
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE o.delivery_status = '4'
    AND o.order_type IS DISTINCT FROM 'return'
    AND o.isarchived IS NOT TRUE
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
)
AND i.sold_quantity != 0;