-- ============================================
-- الإصلاح النهائي: BEFORE DELETE على orders يجلب items قبل الحذف
-- ============================================

-- 1) حذف trigger الخاطئ من order_items
DROP TRIGGER IF EXISTS auto_release_stock_on_item_delete ON order_items;
DROP FUNCTION IF EXISTS auto_release_stock_on_item_delete();

-- 2) حذف أي trigger قديم على orders
DROP TRIGGER IF EXISTS auto_release_stock_before_order_delete ON orders;
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
DROP FUNCTION IF EXISTS auto_release_stock_before_order_delete();
DROP FUNCTION IF EXISTS auto_release_stock_on_order_delete();

-- 3) إنشاء الدالة الجديدة
CREATE OR REPLACE FUNCTION auto_release_stock_before_order_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
  v_inv RECORD;
  v_all_products TEXT := '';
  v_total_released INT := 0;
  v_products_array JSONB := '[]'::JSONB;
BEGIN
  -- تجاهل الطلبات المؤرشفة أو المسلمة
  IF OLD.isarchived = true OR OLD.delivery_status = '4' THEN
    RETURN OLD;
  END IF;
  
  -- تجاهل طلبات الإرجاع الواردة
  IF OLD.order_type = 'return' THEN
    IF EXISTS (SELECT 1 FROM order_items WHERE order_id = OLD.id AND item_direction = 'incoming') THEN
      RETURN OLD;
    END IF;
  END IF;
  
  -- ✅ جلب كل order_items قبل أن يُحذف الطلب
  FOR v_item IN 
    SELECT oi.variant_id, oi.quantity, oi.item_direction
    FROM order_items oi
    WHERE oi.order_id = OLD.id AND oi.variant_id IS NOT NULL
  LOOP
    -- تجاهل العناصر الواردة
    IF v_item.item_direction = 'incoming' THEN
      CONTINUE;
    END IF;
    
    -- جلب معلومات المنتج
    SELECT 
      p.name,
      COALESCE(c.name, 'بدون لون'),
      COALESCE(sz.name, 'بدون مقاس')
    INTO v_product_name, v_color_name, v_size_name
    FROM product_variants pv
    LEFT JOIN products p ON p.id = pv.product_id
    LEFT JOIN colors c ON c.id = pv.color_id
    LEFT JOIN sizes sz ON sz.id = pv.size_id
    WHERE pv.id = v_item.variant_id;
    
    -- تخطي إذا لم يوجد منتج
    IF v_product_name IS NULL THEN
      CONTINUE;
    END IF;
    
    -- جلب المخزون الحالي
    SELECT reserved_quantity, quantity, sold_quantity INTO v_inv
    FROM inventory WHERE variant_id = v_item.variant_id;
    
    -- تحرير المخزون فقط إذا كان هناك محجوز كافي
    IF v_inv IS NOT NULL AND v_inv.reserved_quantity >= v_item.quantity THEN
      UPDATE inventory 
      SET reserved_quantity = reserved_quantity - v_item.quantity
      WHERE variant_id = v_item.variant_id;
      
      -- إضافة للرسالة المجمعة
      v_all_products := v_all_products || v_item.quantity || ' × ' || 
                        v_product_name || ' (' || v_color_name || '/' || v_size_name || ')' || E'\n';
      v_total_released := v_total_released + v_item.quantity;
      
      -- إضافة للمصفوفة
      v_products_array := v_products_array || jsonb_build_object(
        'product_name', v_product_name,
        'color', v_color_name,
        'size', v_size_name,
        'quantity', v_item.quantity
      );
      
      -- تسجيل في product_tracking_log
      INSERT INTO product_tracking_log (
        variant_id, operation_type, source_type,
        quantity_change, stock_before, stock_after,
        reserved_before, reserved_after,
        sold_before, sold_after,
        available_before, available_after,
        tracking_number, reference_number,
        notes, created_by
      ) VALUES (
        v_item.variant_id,
        'release_reserved',
        'order_deleted',
        v_item.quantity,
        v_inv.quantity,
        v_inv.quantity,
        v_inv.reserved_quantity,
        v_inv.reserved_quantity - v_item.quantity,
        COALESCE(v_inv.sold_quantity, 0),
        COALESCE(v_inv.sold_quantity, 0),
        v_inv.quantity - v_inv.reserved_quantity,
        v_inv.quantity - (v_inv.reserved_quantity - v_item.quantity),
        OLD.tracking_number,
        OLD.order_number,
        'تحرير مخزون محجوز بسبب حذف الطلب - ' || v_product_name || ' (' || v_color_name || '/' || v_size_name || ')',
        OLD.created_by
      );
    END IF;
  END LOOP;
  
  -- إرسال إشعار واحد موحد إذا تم تحرير أي مخزون
  IF v_total_released > 0 THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      OLD.created_by,
      'تم تحرير مخزون محجوز',
      'تم تحرير ' || v_total_released || ' قطعة بسبب حذف الطلب ' || COALESCE(OLD.tracking_number, OLD.order_number) || E'\n' || v_all_products,
      'inventory_released',
      jsonb_build_object(
        'order_id', OLD.id,
        'tracking_number', OLD.tracking_number,
        'order_number', OLD.order_number,
        'total_released', v_total_released,
        'products', v_products_array
      )
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- 4) إنشاء الـ trigger على orders
CREATE TRIGGER auto_release_stock_before_order_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_before_order_delete();