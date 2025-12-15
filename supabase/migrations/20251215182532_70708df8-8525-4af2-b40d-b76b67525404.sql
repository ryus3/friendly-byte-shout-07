-- إصلاح عاجل: تصحيح خطأ s.value → sz.value في trigger الحذف

-- 1. إصلاح دالة auto_release_stock_on_order_delete
CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_value TEXT;
  v_reserved_before INTEGER;
  v_reserved_after INTEGER;
  v_stock_before INTEGER;
  v_available_before INTEGER;
  v_available_after INTEGER;
  v_sold_before INTEGER;
BEGIN
  -- تجاهل الطلبات المؤرشفة أو المرتجعات الواردة
  IF OLD.isarchived = true OR (OLD.order_type = 'return' AND OLD.direction = 'incoming') THEN
    RETURN OLD;
  END IF;
  
  -- تجاهل الطلبات المسلمة أو المرتجعة (المخزون محرر مسبقاً)
  IF OLD.delivery_status IN ('4', '17') THEN
    RETURN OLD;
  END IF;

  -- معالجة كل عنصر في الطلب
  FOR item IN 
    SELECT 
      oi.variant_id,
      oi.quantity,
      p.name as product_name,
      COALESCE(c.name, 'بدون لون') as color_name,
      COALESCE(sz.value, '') as size_value
    FROM order_items oi
    JOIN product_variants pv ON oi.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes sz ON pv.size_id = sz.id
    WHERE oi.order_id = OLD.id
  LOOP
    -- جلب القيم الحالية من المخزون
    SELECT 
      COALESCE(quantity, 0),
      COALESCE(reserved_quantity, 0),
      COALESCE(sold_quantity, 0)
    INTO v_stock_before, v_reserved_before, v_sold_before
    FROM inventory
    WHERE variant_id = item.variant_id;
    
    -- حساب المتاح قبل
    v_available_before := v_stock_before - v_reserved_before;
    
    -- تحديث المخزون - تقليل المحجوز فقط
    UPDATE inventory
    SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
        updated_at = NOW()
    WHERE variant_id = item.variant_id;
    
    -- جلب القيم بعد التحديث
    SELECT COALESCE(reserved_quantity, 0)
    INTO v_reserved_after
    FROM inventory
    WHERE variant_id = item.variant_id;
    
    v_available_after := v_stock_before - v_reserved_after;
    
    -- تسجيل في product_tracking_log
    INSERT INTO product_tracking_log (
      variant_id,
      operation_type,
      source_type,
      tracking_number,
      reference_number,
      stock_before,
      stock_after,
      reserved_before,
      reserved_after,
      sold_before,
      sold_after,
      available_before,
      available_after,
      quantity_change,
      notes,
      created_by
    ) VALUES (
      item.variant_id,
      'release_reserved',
      'order_deleted',
      OLD.tracking_number,
      OLD.order_number,
      v_stock_before,
      v_stock_before,
      v_reserved_before,
      v_reserved_after,
      v_sold_before,
      v_sold_before,
      v_available_before,
      v_available_after,
      item.quantity,
      'تحرير محجوز بسبب حذف الطلب: ' || COALESCE(OLD.tracking_number, OLD.order_number),
      OLD.created_by
    );
    
    -- حفظ تفاصيل المنتج للإشعار
    v_product_name := item.product_name;
    v_color_name := item.color_name;
    v_size_value := item.size_value;
    
    -- إرسال إشعار inventory_released
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      OLD.created_by,
      'inventory_released',
      'تحرير مخزون',
      'تم تحرير ' || item.quantity || ' من ' || v_product_name || 
        CASE WHEN v_color_name != 'بدون لون' THEN ' - ' || v_color_name ELSE '' END ||
        CASE WHEN v_size_value != '' THEN ' - ' || v_size_value ELSE '' END ||
        ' (طلب: ' || COALESCE(OLD.tracking_number, OLD.order_number) || ')',
      jsonb_build_object(
        'order_id', OLD.id,
        'tracking_number', OLD.tracking_number,
        'variant_id', item.variant_id,
        'product_name', v_product_name,
        'color', v_color_name,
        'size', v_size_value,
        'quantity_released', item.quantity
      )
    );
  END LOOP;

  RETURN OLD;
END;
$$;

-- 2. إعادة إنشاء trigger الحذف
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON orders;
CREATE TRIGGER auto_release_stock_on_order_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_order_delete();

-- 3. إصلاح handle_order_status_change للـ partial_delivery مع status 17
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_reserved_before INTEGER;
  v_reserved_after INTEGER;
  v_stock_before INTEGER;
  v_stock_after INTEGER;
  v_sold_before INTEGER;
  v_sold_after INTEGER;
  v_available_before INTEGER;
  v_available_after INTEGER;
BEGIN
  -- تجاهل الطلبات المؤرشفة
  IF NEW.isarchived = true THEN
    RETURN NEW;
  END IF;

  -- تجاهل المرتجعات الواردة
  IF NEW.order_type = 'return' AND NEW.direction = 'incoming' THEN
    RETURN NEW;
  END IF;

  -- معالجة الحالة 4 (مسلم)
  IF NEW.delivery_status = '4' AND OLD.delivery_status != '4' THEN
    -- تجاهل partial_delivery لأن البيع يُسجل عند اختيار المنتجات
    IF NEW.order_type = 'partial_delivery' THEN
      RETURN NEW;
    END IF;
    
    -- تحقق من عدم تسجيل البيع مسبقاً
    IF NEW.sold_recorded = true THEN
      RETURN NEW;
    END IF;
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      SELECT COALESCE(quantity, 0), COALESCE(reserved_quantity, 0), COALESCE(sold_quantity, 0)
      INTO v_stock_before, v_reserved_before, v_sold_before
      FROM inventory WHERE variant_id = item.variant_id;
      
      v_available_before := v_stock_before - v_reserved_before;
      
      UPDATE inventory
      SET 
        quantity = GREATEST(0, quantity - item.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
        sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
        updated_at = NOW()
      WHERE variant_id = item.variant_id;
      
      SELECT COALESCE(quantity, 0), COALESCE(reserved_quantity, 0), COALESCE(sold_quantity, 0)
      INTO v_stock_after, v_reserved_after, v_sold_after
      FROM inventory WHERE variant_id = item.variant_id;
      
      v_available_after := v_stock_after - v_reserved_after;
      
      INSERT INTO product_tracking_log (
        variant_id, operation_type, source_type, tracking_number, reference_number,
        stock_before, stock_after, reserved_before, reserved_after,
        sold_before, sold_after, available_before, available_after,
        quantity_change, notes, created_by
      ) VALUES (
        item.variant_id, 'sold', 'delivery_status_4', NEW.tracking_number, NEW.order_number,
        v_stock_before, v_stock_after, v_reserved_before, v_reserved_after,
        v_sold_before, v_sold_after, v_available_before, v_available_after,
        item.quantity, 'تسليم طلب: ' || COALESCE(NEW.tracking_number, NEW.order_number), NEW.created_by
      );
    END LOOP;
    
    NEW.sold_recorded := true;
    RETURN NEW;
  END IF;

  -- معالجة الحالة 17 (مرتجع للتاجر)
  IF NEW.delivery_status = '17' AND OLD.delivery_status != '17' THEN
    -- للـ partial_delivery: استخدم 'returned' وليس 'returned_in_stock'
    IF NEW.order_type = 'partial_delivery' THEN
      NEW.status := 'returned';
    ELSE
      NEW.status := 'returned_in_stock';
    END IF;
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      SELECT COALESCE(quantity, 0), COALESCE(reserved_quantity, 0), COALESCE(sold_quantity, 0)
      INTO v_stock_before, v_reserved_before, v_sold_before
      FROM inventory WHERE variant_id = item.variant_id;
      
      v_available_before := v_stock_before - v_reserved_before;
      
      -- تحرير المحجوز فقط، لا نزيد الكمية
      UPDATE inventory
      SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          updated_at = NOW()
      WHERE variant_id = item.variant_id;
      
      SELECT COALESCE(reserved_quantity, 0)
      INTO v_reserved_after
      FROM inventory WHERE variant_id = item.variant_id;
      
      v_available_after := v_stock_before - v_reserved_after;
      
      INSERT INTO product_tracking_log (
        variant_id, operation_type, source_type, tracking_number, reference_number,
        stock_before, stock_after, reserved_before, reserved_after,
        sold_before, sold_after, available_before, available_after,
        quantity_change, notes, created_by
      ) VALUES (
        item.variant_id, 'release_reserved', 'status_17_return', NEW.tracking_number, NEW.order_number,
        v_stock_before, v_stock_before, v_reserved_before, v_reserved_after,
        v_sold_before, v_sold_before, v_available_before, v_available_after,
        item.quantity, 'تحرير محجوز بسبب إرجاع: ' || COALESCE(NEW.tracking_number, NEW.order_number), NEW.created_by
      );
      
      -- إشعار تحرير المخزون
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        NEW.created_by,
        'inventory_released',
        'تحرير مخزون',
        'تم تحرير محجوز للطلب: ' || COALESCE(NEW.tracking_number, NEW.order_number),
        jsonb_build_object('order_id', NEW.id, 'tracking_number', NEW.tracking_number, 'variant_id', item.variant_id)
      );
    END LOOP;
    
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. إعادة إنشاء trigger تغيير الحالة
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;
CREATE TRIGGER trg_handle_order_status_change
  BEFORE UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_change();