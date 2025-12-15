
-- ============================================
-- إصلاح جذري: trigger الحذف + handle_order_status_change
-- ============================================

-- 1. إصلاح دالة الحذف التلقائي لتعمل بشكل صحيح
CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  inv RECORD;
  product_name TEXT;
  color_name TEXT;
  size_value TEXT;
  total_released INT := 0;
  notification_details TEXT := '';
BEGIN
  -- تجاهل الطلبات المؤرشفة أو الراجعة
  IF OLD.isarchived = TRUE OR OLD.order_type = 'return' THEN
    RETURN OLD;
  END IF;
  
  -- تجاهل الطلبات المسلمة أو المرجعة للمخزن (لا يوجد محجوز)
  IF OLD.delivery_status IN ('4', '17') THEN
    RETURN OLD;
  END IF;

  -- معالجة كل منتج في الطلب
  FOR item IN 
    SELECT oi.variant_id, oi.quantity, oi.item_status
    FROM order_items oi
    WHERE oi.order_id = OLD.id
      AND oi.item_direction IS DISTINCT FROM 'incoming'
      AND oi.item_status IS DISTINCT FROM 'delivered'
  LOOP
    IF item.variant_id IS NOT NULL AND item.quantity > 0 THEN
      -- جلب بيانات المخزون الحالية
      SELECT i.*, p.name as prod_name, c.name as col_name, s.value as sz_value
      INTO inv
      FROM inventory i
      JOIN product_variants pv ON pv.id = i.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN colors c ON c.id = pv.color_id
      LEFT JOIN sizes s ON s.id = pv.size_id
      WHERE i.variant_id = item.variant_id;
      
      IF inv IS NOT NULL AND inv.reserved_quantity >= item.quantity THEN
        -- تسجيل قبل التحديث
        INSERT INTO product_tracking_log (
          variant_id, operation_type, source_type,
          stock_before, stock_after,
          reserved_before, reserved_after,
          sold_before, sold_after,
          available_before, available_after,
          quantity_change, tracking_number, reference_number, notes
        ) VALUES (
          item.variant_id, 'release_reserved', 'order_deleted',
          inv.quantity, inv.quantity,
          inv.reserved_quantity, inv.reserved_quantity - item.quantity,
          inv.sold_quantity, inv.sold_quantity,
          inv.quantity - inv.reserved_quantity, inv.quantity - (inv.reserved_quantity - item.quantity),
          item.quantity, OLD.tracking_number, OLD.order_number,
          'تحرير تلقائي عند حذف الطلب'
        );
        
        -- تحديث المخزون - تقليل المحجوز فقط
        UPDATE inventory
        SET reserved_quantity = reserved_quantity - item.quantity,
            updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        -- تجميع تفاصيل الإشعار
        product_name := inv.prod_name;
        color_name := COALESCE(inv.col_name, 'بدون لون');
        size_value := COALESCE(inv.sz_value, 'بدون مقاس');
        
        IF notification_details != '' THEN
          notification_details := notification_details || '، ';
        END IF;
        notification_details := notification_details || product_name || ' (' || color_name || '/' || size_value || ') x' || item.quantity;
        
        total_released := total_released + item.quantity;
      END IF;
    END IF;
  END LOOP;

  -- إرسال إشعار إذا تم تحرير منتجات
  IF total_released > 0 AND OLD.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      OLD.created_by,
      'تم تحرير مخزون محجوز',
      'تم تحرير ' || total_released || ' قطعة عند حذف الطلب ' || COALESCE(OLD.tracking_number, OLD.order_number) || ': ' || notification_details,
      'inventory_released',
      jsonb_build_object(
        'order_id', OLD.id,
        'tracking_number', OLD.tracking_number,
        'order_number', OLD.order_number,
        'total_released', total_released,
        'products', notification_details
      )
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- حذف أي triggers قديمة وإعادة إنشاء الـ trigger بشكل صحيح
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON orders;

CREATE TRIGGER auto_release_stock_on_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_order_delete();

-- 2. إصلاح handle_order_status_change لتجنب خطأ partial_delivery
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  inv RECORD;
  new_status TEXT;
BEGIN
  -- فقط عند تغيير delivery_status
  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- تجاهل الطلبات المؤرشفة أو الراجعة
  IF NEW.isarchived = TRUE OR NEW.order_type = 'return' THEN
    RETURN NEW;
  END IF;

  -- ===============================
  -- الحالة 4: تم التسليم (مباع)
  -- ===============================
  IF NEW.delivery_status = '4' AND OLD.delivery_status IS DISTINCT FROM '4' THEN
    -- تجاهل إذا سبق تسجيل المبيعات
    IF NEW.sold_recorded = TRUE THEN
      RETURN NEW;
    END IF;
    
    -- تجاهل التسليم الجزئي (يُعالج بشكل منفصل)
    IF NEW.order_type = 'partial_delivery' THEN
      NEW.status := 'completed';
      RETURN NEW;
    END IF;

    FOR item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.item_direction IS DISTINCT FROM 'incoming'
    LOOP
      IF item.variant_id IS NOT NULL AND item.quantity > 0 THEN
        SELECT * INTO inv FROM inventory WHERE variant_id = item.variant_id;
        
        IF inv IS NOT NULL THEN
          -- تسجيل العملية
          INSERT INTO product_tracking_log (
            variant_id, operation_type, source_type,
            stock_before, stock_after,
            reserved_before, reserved_after,
            sold_before, sold_after,
            available_before, available_after,
            quantity_change, tracking_number, reference_number
          ) VALUES (
            item.variant_id, 'sold', 'delivery_completed',
            inv.quantity, inv.quantity - item.quantity,
            inv.reserved_quantity, GREATEST(0, inv.reserved_quantity - item.quantity),
            inv.sold_quantity, inv.sold_quantity + item.quantity,
            inv.quantity - inv.reserved_quantity, (inv.quantity - item.quantity) - GREATEST(0, inv.reserved_quantity - item.quantity),
            item.quantity, NEW.tracking_number, NEW.order_number
          );
          
          -- تحديث المخزون
          UPDATE inventory
          SET quantity = quantity - item.quantity,
              reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
              sold_quantity = sold_quantity + item.quantity,
              updated_at = NOW()
          WHERE variant_id = item.variant_id;
        END IF;
      END IF;
    END LOOP;

    NEW.sold_recorded := TRUE;
    NEW.status := 'completed';
  END IF;

  -- ===============================
  -- الحالة 17: مرتجع للمخزن (تحرير المحجوز فقط)
  -- ===============================
  IF NEW.delivery_status = '17' AND OLD.delivery_status IS DISTINCT FROM '17' THEN
    -- ✅ إصلاح: استخدام 'returned' للتسليم الجزئي بدلاً من 'returned_in_stock'
    IF NEW.order_type = 'partial_delivery' THEN
      new_status := 'returned';
    ELSE
      new_status := 'returned_in_stock';
    END IF;
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.item_status
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.item_direction IS DISTINCT FROM 'incoming'
        AND oi.item_status IS DISTINCT FROM 'delivered'
    LOOP
      IF item.variant_id IS NOT NULL AND item.quantity > 0 THEN
        SELECT * INTO inv FROM inventory WHERE variant_id = item.variant_id;
        
        IF inv IS NOT NULL AND inv.reserved_quantity >= item.quantity THEN
          -- تسجيل العملية
          INSERT INTO product_tracking_log (
            variant_id, operation_type, source_type,
            stock_before, stock_after,
            reserved_before, reserved_after,
            sold_before, sold_after,
            available_before, available_after,
            quantity_change, tracking_number, reference_number
          ) VALUES (
            item.variant_id, 'release_reserved', 'status_17_return',
            inv.quantity, inv.quantity,
            inv.reserved_quantity, inv.reserved_quantity - item.quantity,
            inv.sold_quantity, inv.sold_quantity,
            inv.quantity - inv.reserved_quantity, inv.quantity - (inv.reserved_quantity - item.quantity),
            item.quantity, NEW.tracking_number, NEW.order_number
          );
          
          -- تحرير المحجوز فقط - لا نزيد الكمية
          UPDATE inventory
          SET reserved_quantity = reserved_quantity - item.quantity,
              updated_at = NOW()
          WHERE variant_id = item.variant_id;
        END IF;
      END IF;
    END LOOP;

    -- إرسال إشعار تحرير المخزون
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.created_by,
        'تم تحرير مخزون محجوز',
        'تم تحرير المخزون المحجوز للطلب ' || COALESCE(NEW.tracking_number, NEW.order_number) || ' بسبب إرجاعه للمخزن',
        'inventory_released',
        jsonb_build_object('order_id', NEW.id, 'tracking_number', NEW.tracking_number, 'reason', 'status_17')
      );
    END IF;

    NEW.status := new_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;

CREATE TRIGGER trg_handle_order_status_change
  BEFORE UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_change();
