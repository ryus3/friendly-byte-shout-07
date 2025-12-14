-- إصلاح trigger الحذف التلقائي ليرسل الإشعارات بشكل صحيح
CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
  v_tracking_number TEXT;
  v_old_reserved INT;
  v_new_reserved INT;
  v_old_quantity INT;
  v_old_available INT;
  v_new_available INT;
  v_old_sold INT;
BEGIN
  v_tracking_number := COALESCE(OLD.tracking_number, OLD.order_number);
  
  RAISE LOG 'auto_release_stock_on_order_delete: بدء تنفيذ للطلب % delivery_status=%', OLD.id, OLD.delivery_status;
  
  -- فقط للطلبات التي لها حجز (ليست مسلمة أو مرتجعة)
  IF OLD.delivery_status IS NULL OR OLD.delivery_status NOT IN ('4', '17') THEN
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.product_id
      FROM order_items oi
      WHERE oi.order_id = OLD.id
    LOOP
      BEGIN
        RAISE LOG 'auto_release_stock_on_order_delete: معالجة variant_id=% quantity=%', item.variant_id, item.quantity;
        
        -- جلب اسم المنتج واللون والمقاس بشكل آمن
        SELECT 
          p.name,
          COALESCE(c.name, 'بدون لون'),
          COALESCE(sz.name, 'بدون مقاس')
        INTO v_product_name, v_color_name, v_size_name
        FROM products p
        LEFT JOIN product_variants pv ON pv.id = item.variant_id
        LEFT JOIN colors c ON c.id = pv.color_id
        LEFT JOIN sizes sz ON sz.id = pv.size_id
        WHERE p.id = item.product_id;
        
        -- جلب القيم الحالية
        SELECT reserved_quantity, quantity, sold_quantity
        INTO v_old_reserved, v_old_quantity, v_old_sold
        FROM inventory
        WHERE variant_id = item.variant_id;
        
        v_old_available := COALESCE(v_old_quantity, 0) - COALESCE(v_old_reserved, 0);
        
        -- تحديث المخزون: تقليل المحجوز فقط
        UPDATE inventory
        SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
            updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        -- جلب القيمة الجديدة
        SELECT reserved_quantity INTO v_new_reserved
        FROM inventory WHERE variant_id = item.variant_id;
        
        v_new_available := COALESCE(v_old_quantity, 0) - COALESCE(v_new_reserved, 0);
        
        RAISE LOG 'auto_release_stock_on_order_delete: تم تحديث reserved من % إلى %', v_old_reserved, v_new_reserved;
        
        -- تسجيل العملية في product_tracking_log
        INSERT INTO product_tracking_log (
          variant_id, product_id, operation_type, source_type,
          quantity_change, stock_before, stock_after,
          reserved_before, reserved_after,
          available_before, available_after,
          sold_before, sold_after,
          tracking_number, reference_number, notes, created_by
        ) VALUES (
          item.variant_id, item.product_id, 'release_reserved', 'order_deleted',
          item.quantity, v_old_quantity, v_old_quantity,
          v_old_reserved, v_new_reserved,
          v_old_available, v_new_available,
          v_old_sold, v_old_sold,
          v_tracking_number, OLD.order_number, 
          'تحرير محجوز بسبب حذف الطلب - ' || COALESCE(v_product_name, 'منتج') || ' ' || v_color_name || ' ' || v_size_name,
          OLD.created_by
        );
        
        RAISE LOG 'auto_release_stock_on_order_delete: تم التسجيل في product_tracking_log';
        
        -- إرسال الإشعار
        INSERT INTO notifications (user_id, title, message, type, data, priority)
        VALUES (
          OLD.created_by,
          'تم تحرير مخزون محجوز',
          'تم حذف الطلب ' || v_tracking_number || ' وتحرير ' || item.quantity || ' قطعة من ' || COALESCE(v_product_name, 'منتج') || ' ' || v_color_name || ' ' || v_size_name,
          'inventory_released',
          jsonb_build_object(
            'order_id', OLD.id,
            'order_number', OLD.order_number,
            'tracking_number', v_tracking_number,
            'variant_id', item.variant_id,
            'quantity_released', item.quantity,
            'product_name', v_product_name,
            'color', v_color_name,
            'size', v_size_name
          ),
          'medium'
        );
        
        RAISE LOG 'auto_release_stock_on_order_delete: تم إرسال الإشعار بنجاح';
        
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'auto_release_stock_on_order_delete: خطأ في variant %: %', item.variant_id, SQLERRM;
      END;
    END LOOP;
  ELSE
    RAISE LOG 'auto_release_stock_on_order_delete: تخطي الطلب لأن delivery_status=%', OLD.delivery_status;
  END IF;
  
  RETURN OLD;
END;
$$;

-- التأكد من أن الـ trigger مفعل
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON orders;
CREATE TRIGGER auto_release_stock_on_order_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_order_delete();