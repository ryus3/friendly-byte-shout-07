
-- ===========================================
-- الإصلاح الشامل والنهائي لتحرير المخزون عند الحذف
-- ===========================================

-- 1. إنشاء دالة تحرير المخزون على مستوى order_items
-- هذا يحل مشكلة ON DELETE CASCADE الذي يحذف items قبل trigger الـ orders
CREATE OR REPLACE FUNCTION auto_release_stock_on_item_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_order RECORD;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
  v_inv RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- جلب معلومات الطلب
  SELECT id, order_number, tracking_number, status, delivery_status, 
         isarchived, order_type, created_by
  INTO v_order
  FROM orders
  WHERE id = OLD.order_id;
  
  -- تجاهل الطلبات المؤرشفة
  IF v_order.isarchived = true THEN
    RETURN OLD;
  END IF;
  
  -- تجاهل الطلبات المسلمة (delivery_status = 4)
  IF v_order.delivery_status = '4' THEN
    RETURN OLD;
  END IF;
  
  -- تجاهل طلبات الإرجاع الواردة (incoming returns)
  IF v_order.order_type = 'return' AND OLD.item_direction = 'incoming' THEN
    RETURN OLD;
  END IF;
  
  -- جلب معلومات المنتج للإشعار
  SELECT 
    p.name,
    COALESCE(c.name, 'بدون لون') as color_name,
    COALESCE(sz.name, 'بدون مقاس') as size_name
  INTO v_product_name, v_color_name, v_size_name
  FROM product_variants pv
  LEFT JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes sz ON sz.id = pv.size_id
  WHERE pv.id = OLD.variant_id;
  
  -- جلب المخزون الحالي
  SELECT reserved_quantity, quantity
  INTO v_inv
  FROM inventory
  WHERE variant_id = OLD.variant_id;
  
  -- تحرير المخزون المحجوز
  IF v_inv.reserved_quantity >= OLD.quantity THEN
    UPDATE inventory SET
      reserved_quantity = reserved_quantity - OLD.quantity,
      updated_at = NOW()
    WHERE variant_id = OLD.variant_id;
    
    -- تسجيل في product_tracking_log
    INSERT INTO product_tracking_log (
      variant_id,
      operation_type,
      source_type,
      stock_before,
      stock_after,
      reserved_before,
      reserved_after,
      sold_before,
      sold_after,
      available_before,
      available_after,
      quantity_change,
      tracking_number,
      reference_number,
      notes,
      created_by
    )
    SELECT
      OLD.variant_id,
      'release_reserved',
      'order_deleted',
      v_inv.quantity,
      v_inv.quantity,
      v_inv.reserved_quantity,
      v_inv.reserved_quantity - OLD.quantity,
      COALESCE(inv.sold_quantity, 0),
      COALESCE(inv.sold_quantity, 0),
      v_inv.quantity - v_inv.reserved_quantity,
      v_inv.quantity - (v_inv.reserved_quantity - OLD.quantity),
      OLD.quantity,
      v_order.tracking_number,
      v_order.order_number,
      'تحرير مخزون محجوز - حذف طلب: ' || COALESCE(v_order.tracking_number, v_order.order_number),
      v_order.created_by
    FROM inventory inv
    WHERE inv.variant_id = OLD.variant_id;
    
    -- إرسال إشعار inventory_released
    v_notification_title := 'تم تحرير مخزون محجوز';
    v_notification_message := 'تم تحرير ' || OLD.quantity || ' قطعة من "' || 
                              COALESCE(v_product_name, 'منتج') || 
                              ' - ' || v_color_name || ' - ' || v_size_name || 
                              '" بسبب حذف الطلب ' || COALESCE(v_order.tracking_number, v_order.order_number);
    
    -- إرسال للمستخدم الذي أنشأ الطلب
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      v_order.created_by,
      v_notification_title,
      v_notification_message,
      'inventory_released',
      jsonb_build_object(
        'order_id', v_order.id,
        'tracking_number', v_order.tracking_number,
        'order_number', v_order.order_number,
        'product_name', v_product_name,
        'color', v_color_name,
        'size', v_size_name,
        'quantity_released', OLD.quantity
      )
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- 2. حذف trigger القديم على orders إذا كان موجوداً
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
DROP FUNCTION IF EXISTS auto_release_stock_on_delete() CASCADE;

-- 3. إنشاء trigger جديد على order_items
DROP TRIGGER IF EXISTS auto_release_stock_on_item_delete ON order_items;
CREATE TRIGGER auto_release_stock_on_item_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_item_delete();

-- 4. تحديث handle_order_status_change لإصلاح sz.value → sz.name
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  item RECORD;
  inv RECORD;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
  v_is_return_incoming BOOLEAN := false;
BEGIN
  -- فحص إذا كان طلب إرجاع وارد
  IF NEW.order_type = 'return' THEN
    SELECT EXISTS (
      SELECT 1 FROM order_items 
      WHERE order_id = NEW.id AND item_direction = 'incoming'
    ) INTO v_is_return_incoming;
  END IF;

  -- عند التسليم (delivery_status = 4)
  IF NEW.delivery_status = '4' AND OLD.delivery_status != '4' AND NEW.sold_recorded = false THEN
    -- تجاهل طلبات الإرجاع الواردة
    IF v_is_return_incoming THEN
      RETURN NEW;
    END IF;
    
    -- تجاهل التسليم الجزئي المكتمل
    IF NEW.order_type = 'partial_delivery' THEN
      RETURN NEW;
    END IF;
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity 
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      SELECT quantity, reserved_quantity, sold_quantity INTO inv
      FROM inventory WHERE variant_id = item.variant_id;
      
      IF inv IS NOT NULL THEN
        -- جلب معلومات المنتج
        SELECT p.name, COALESCE(c.name, 'بدون لون'), COALESCE(sz.name, 'بدون مقاس')
        INTO v_product_name, v_color_name, v_size_name
        FROM product_variants pv
        LEFT JOIN products p ON p.id = pv.product_id
        LEFT JOIN colors c ON c.id = pv.color_id
        LEFT JOIN sizes sz ON sz.id = pv.size_id
        WHERE pv.id = item.variant_id;
        
        -- تحديث المخزون: نقص الكمية والمحجوز، زيادة المباع
        UPDATE inventory SET
          quantity = quantity - item.quantity,
          reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
          updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        -- تسجيل في product_tracking_log
        INSERT INTO product_tracking_log (
          variant_id, operation_type, source_type,
          stock_before, stock_after,
          reserved_before, reserved_after,
          sold_before, sold_after,
          available_before, available_after,
          quantity_change, tracking_number, reference_number,
          notes, created_by
        ) VALUES (
          item.variant_id, 'sold', 'order_delivered',
          inv.quantity, inv.quantity - item.quantity,
          inv.reserved_quantity, GREATEST(0, inv.reserved_quantity - item.quantity),
          COALESCE(inv.sold_quantity, 0), COALESCE(inv.sold_quantity, 0) + item.quantity,
          inv.quantity - inv.reserved_quantity, 
          (inv.quantity - item.quantity) - GREATEST(0, inv.reserved_quantity - item.quantity),
          item.quantity, NEW.tracking_number, NEW.order_number,
          'تسليم طلب: ' || COALESCE(NEW.tracking_number, NEW.order_number),
          NEW.created_by
        );
      END IF;
    END LOOP;
    
    NEW.sold_recorded := true;
  END IF;
  
  -- عند الإرجاع للتاجر (delivery_status = 17)
  IF NEW.delivery_status = '17' AND OLD.delivery_status != '17' THEN
    -- تجاهل طلبات الإرجاع الواردة
    IF v_is_return_incoming THEN
      RETURN NEW;
    END IF;
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity 
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      SELECT quantity, reserved_quantity, sold_quantity INTO inv
      FROM inventory WHERE variant_id = item.variant_id;
      
      IF inv IS NOT NULL AND inv.reserved_quantity >= item.quantity THEN
        -- جلب معلومات المنتج
        SELECT p.name, COALESCE(c.name, 'بدون لون'), COALESCE(sz.name, 'بدون مقاس')
        INTO v_product_name, v_color_name, v_size_name
        FROM product_variants pv
        LEFT JOIN products p ON p.id = pv.product_id
        LEFT JOIN colors c ON c.id = pv.color_id
        LEFT JOIN sizes sz ON sz.id = pv.size_id
        WHERE pv.id = item.variant_id;
        
        -- تحرير المحجوز فقط (لا نزيد الكمية)
        UPDATE inventory SET
          reserved_quantity = reserved_quantity - item.quantity,
          updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        -- تسجيل في product_tracking_log
        INSERT INTO product_tracking_log (
          variant_id, operation_type, source_type,
          stock_before, stock_after,
          reserved_before, reserved_after,
          sold_before, sold_after,
          available_before, available_after,
          quantity_change, tracking_number, reference_number,
          notes, created_by
        ) VALUES (
          item.variant_id, 'release_reserved', 'order_returned',
          inv.quantity, inv.quantity,
          inv.reserved_quantity, inv.reserved_quantity - item.quantity,
          COALESCE(inv.sold_quantity, 0), COALESCE(inv.sold_quantity, 0),
          inv.quantity - inv.reserved_quantity, 
          inv.quantity - (inv.reserved_quantity - item.quantity),
          item.quantity, NEW.tracking_number, NEW.order_number,
          'إرجاع للتاجر: ' || COALESCE(NEW.tracking_number, NEW.order_number),
          NEW.created_by
        );
        
        -- إرسال إشعار
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.created_by,
          'تم تحرير مخزون محجوز',
          'تم تحرير ' || item.quantity || ' قطعة من "' || 
          COALESCE(v_product_name, 'منتج') || ' - ' || v_color_name || ' - ' || v_size_name || 
          '" بسبب إرجاع الطلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
          'inventory_released',
          jsonb_build_object(
            'order_id', NEW.id,
            'tracking_number', NEW.tracking_number,
            'product_name', v_product_name,
            'quantity_released', item.quantity
          )
        );
      END IF;
    END LOOP;
    
    -- تحديث حالة التسليم الجزئي
    IF NEW.order_type = 'partial_delivery' THEN
      NEW.status := 'returned';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. إعادة إنشاء trigger على orders
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;
CREATE TRIGGER trg_handle_order_status_change
  BEFORE UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_change();
