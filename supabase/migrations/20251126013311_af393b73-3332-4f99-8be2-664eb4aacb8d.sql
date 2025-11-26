-- إصلاح إشعارات الحذف لتعرض رقم التتبع بدلاً من رقم الطلب
-- Fix deletion notifications to show tracking number instead of order number

-- Drop existing trigger
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON orders;

-- Recreate function with tracking_number in notification
CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_product_name TEXT;
BEGIN
  -- تحرير المخزون المحجوز لجميع منتجات الطلب المحذوف
  FOR v_item IN 
    SELECT oi.variant_id, oi.quantity, pv.product_id
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = OLD.id
      AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'completed')
      AND (OLD.order_type != 'return' OR OLD.direction != 'incoming')
  LOOP
    -- تحديث المخزون المحجوز
    UPDATE inventory
    SET 
      reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
      updated_at = NOW()
    WHERE variant_id = v_item.variant_id;

    -- الحصول على اسم المنتج للإشعار
    SELECT name INTO v_product_name
    FROM products
    WHERE id = v_item.product_id
    LIMIT 1;

    -- إرسال إشعار بتحرير المخزون (استخدام tracking_number أولاً)
    INSERT INTO notifications (user_id, title, message, type, data, created_at)
    VALUES (
      OLD.created_by,
      'تم تحرير مخزون محجوز',
      'تم حذف الطلب ' || COALESCE(OLD.tracking_number, OLD.order_number, OLD.id::text) || ' وتحرير ' || v_item.quantity || ' قطعة من ' || COALESCE(v_product_name, 'المنتج'),
      'inventory_released',
      jsonb_build_object(
        'order_id', OLD.id,
        'tracking_number', OLD.tracking_number,
        'order_number', OLD.order_number,
        'variant_id', v_item.variant_id,
        'product_name', v_product_name,
        'quantity_released', v_item.quantity
      ),
      NOW()
    );
  END LOOP;

  RETURN OLD;
END;
$$;

-- Recreate trigger
CREATE TRIGGER auto_release_stock_on_order_delete
AFTER DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_release_stock_on_order_delete();

COMMENT ON FUNCTION auto_release_stock_on_order_delete() IS 'تحرير المخزون المحجوز تلقائياً عند حذف الطلب - يعرض رقم التتبع في الإشعارات';