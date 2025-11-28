-- استعادة دالة auto_release_stock_on_order_delete الكاملة مع الإشعارات
-- مع إصلاح استخدام oi.item_direction بدلاً من OLD.direction

CREATE OR REPLACE FUNCTION public.auto_release_stock_on_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_item RECORD;
  v_product_name TEXT;
BEGIN
  -- تحرير المخزون المحجوز لجميع منتجات الطلب المحذوف
  FOR v_item IN 
    SELECT oi.variant_id, oi.quantity, pv.product_id, oi.item_direction, oi.item_status
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = OLD.id
      AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'completed')
      -- ✅ الإصلاح: استخدام oi.item_direction بدلاً من OLD.direction
      AND (OLD.order_type IS DISTINCT FROM 'return' OR oi.item_direction IS DISTINCT FROM 'incoming')
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

    -- ✅ استعادة الإشعارات المفصلة
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

-- تأكد من وجود trigger واحد فقط
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON public.orders;

CREATE TRIGGER auto_release_stock_on_order_delete
AFTER DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_release_stock_on_order_delete();

COMMENT ON FUNCTION public.auto_release_stock_on_order_delete() IS 'تحرير المخزون المحجوز عند حذف الطلب مع إرسال إشعارات مفصلة - CRITICAL: يتضمن إصلاح استخدام item_direction من order_items';