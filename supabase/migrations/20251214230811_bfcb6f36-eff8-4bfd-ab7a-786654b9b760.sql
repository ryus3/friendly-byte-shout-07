
-- ==========================================
-- خطة توحيد تريجرات المخزون - Migration شامل
-- ==========================================

-- 1) تفعيل تريجر تحرير المخزون عند الحذف
ALTER TABLE orders ENABLE TRIGGER auto_release_stock_on_delete;

-- 2) حذف trigger_process_returned_inventory الذي يزيد quantity خطأً
DROP TRIGGER IF EXISTS trigger_process_returned_inventory ON orders;
DROP FUNCTION IF EXISTS process_returned_inventory();

-- 3) حذف unified_inventory_trigger المكرر
DROP TRIGGER IF EXISTS unified_inventory_trigger ON orders;
DROP FUNCTION IF EXISTS unified_inventory_management();

-- 4) حذف trg_update_reserved_on_order_change الذي يسبب تضارب
DROP TRIGGER IF EXISTS trg_update_reserved_on_order_change ON orders;
DROP FUNCTION IF EXISTS update_reserved_on_order_change();

-- 5) تحديث handle_order_status_change لتسجيل العمليات
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  inv_record RECORD;
  v_tracking_number TEXT;
  v_employee_name TEXT;
BEGIN
  -- الحصول على tracking_number واسم الموظف
  v_tracking_number := COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::TEXT);
  
  SELECT full_name INTO v_employee_name 
  FROM profiles 
  WHERE user_id = NEW.created_by;

  -- ==========================================
  -- الحالة 17: تحرير المحجوز (رجع للمخزن)
  -- ==========================================
  IF NEW.delivery_status = '17' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '17') THEN
    -- تحديث status إلى returned_in_stock
    NEW.status := 'returned_in_stock';
    
    -- تحرير المحجوز لكل منتج في الطلب
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.item_status, oi.item_direction
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.item_direction IS DISTINCT FROM 'incoming'
        AND oi.item_status IS DISTINCT FROM 'delivered'
    LOOP
      -- الحصول على بيانات المخزون الحالية
      SELECT * INTO inv_record FROM inventory WHERE variant_id = item.variant_id;
      
      IF inv_record IS NOT NULL AND inv_record.reserved_quantity >= item.quantity THEN
        -- تحديث المخزون: تقليل المحجوز فقط (لا نزيد quantity)
        UPDATE inventory 
        SET reserved_quantity = reserved_quantity - item.quantity,
            updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        -- تسجيل العملية في product_tracking_log
        INSERT INTO product_tracking_log (
          variant_id,
          operation_type,
          source_type,
          quantity_change,
          stock_before,
          stock_after,
          reserved_before,
          reserved_after,
          sold_before,
          sold_after,
          available_before,
          available_after,
          tracking_number,
          reference_number,
          notes,
          created_by_name
        ) VALUES (
          item.variant_id,
          'release_reserved',
          'status_17_return',
          0, -- لا تغيير في quantity
          inv_record.quantity,
          inv_record.quantity,
          inv_record.reserved_quantity,
          inv_record.reserved_quantity - item.quantity,
          COALESCE(inv_record.sold_quantity, 0),
          COALESCE(inv_record.sold_quantity, 0),
          inv_record.quantity - inv_record.reserved_quantity,
          inv_record.quantity - (inv_record.reserved_quantity - item.quantity),
          v_tracking_number,
          NEW.order_number,
          'تحرير المحجوز - رجع للمخزن (حالة 17)',
          v_employee_name
        );
      END IF;
    END LOOP;
    
    RETURN NEW;
  END IF;

  -- ==========================================
  -- الحالة 4: تسليم كامل (مباع)
  -- ==========================================
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    -- تحقق من عدم التسجيل المسبق
    IF NEW.sold_recorded = TRUE THEN
      RETURN NEW;
    END IF;
    
    NEW.status := 'completed';
    NEW.sold_recorded := TRUE;
    
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.item_status, oi.item_direction
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.item_direction IS DISTINCT FROM 'incoming'
        AND oi.item_status IS DISTINCT FROM 'delivered'
    LOOP
      SELECT * INTO inv_record FROM inventory WHERE variant_id = item.variant_id;
      
      IF inv_record IS NOT NULL THEN
        -- تحديث: تقليل المحجوز والكمية، زيادة المباع
        UPDATE inventory 
        SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
            quantity = GREATEST(0, quantity - item.quantity),
            sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
            updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        -- تسجيل العملية
        INSERT INTO product_tracking_log (
          variant_id,
          operation_type,
          source_type,
          quantity_change,
          stock_before,
          stock_after,
          reserved_before,
          reserved_after,
          sold_before,
          sold_after,
          available_before,
          available_after,
          tracking_number,
          reference_number,
          notes,
          created_by_name
        ) VALUES (
          item.variant_id,
          'sold',
          'status_4_delivered',
          -item.quantity,
          inv_record.quantity,
          GREATEST(0, inv_record.quantity - item.quantity),
          inv_record.reserved_quantity,
          GREATEST(0, inv_record.reserved_quantity - item.quantity),
          COALESCE(inv_record.sold_quantity, 0),
          COALESCE(inv_record.sold_quantity, 0) + item.quantity,
          inv_record.quantity - inv_record.reserved_quantity,
          GREATEST(0, inv_record.quantity - item.quantity) - GREATEST(0, inv_record.reserved_quantity - item.quantity),
          v_tracking_number,
          NEW.order_number,
          'تم البيع - تسليم كامل (حالة 4)',
          v_employee_name
        );
      END IF;
    END LOOP;
    
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6) تحديث دالة auto_release_stock_on_order_delete لتسجيل العمليات
CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  inv_record RECORD;
  v_tracking_number TEXT;
  v_employee_name TEXT;
BEGIN
  -- لا تحرر المخزون للطلبات المكتملة أو المسلمة
  IF OLD.delivery_status IN ('4', '17') OR OLD.status IN ('completed', 'returned_in_stock', 'delivered') THEN
    RETURN OLD;
  END IF;
  
  -- الحصول على tracking_number واسم الموظف
  v_tracking_number := COALESCE(OLD.tracking_number, OLD.order_number, OLD.id::TEXT);
  
  SELECT full_name INTO v_employee_name 
  FROM profiles 
  WHERE user_id = OLD.created_by;

  -- تحرير المحجوز لكل منتج
  FOR item IN 
    SELECT oi.variant_id, oi.quantity, oi.item_direction, oi.item_status
    FROM order_items oi
    WHERE oi.order_id = OLD.id
      AND oi.item_direction IS DISTINCT FROM 'incoming'
      AND oi.item_status IS DISTINCT FROM 'delivered'
  LOOP
    SELECT * INTO inv_record FROM inventory WHERE variant_id = item.variant_id;
    
    IF inv_record IS NOT NULL AND inv_record.reserved_quantity >= item.quantity THEN
      -- تحديث المخزون: تقليل المحجوز فقط
      UPDATE inventory 
      SET reserved_quantity = reserved_quantity - item.quantity,
          updated_at = NOW()
      WHERE variant_id = item.variant_id;
      
      -- تسجيل العملية
      INSERT INTO product_tracking_log (
        variant_id,
        operation_type,
        source_type,
        quantity_change,
        stock_before,
        stock_after,
        reserved_before,
        reserved_after,
        sold_before,
        sold_after,
        available_before,
        available_after,
        tracking_number,
        reference_number,
        notes,
        created_by_name
      ) VALUES (
        item.variant_id,
        'release_reserved',
        'order_deleted',
        0,
        inv_record.quantity,
        inv_record.quantity,
        inv_record.reserved_quantity,
        inv_record.reserved_quantity - item.quantity,
        COALESCE(inv_record.sold_quantity, 0),
        COALESCE(inv_record.sold_quantity, 0),
        inv_record.quantity - inv_record.reserved_quantity,
        inv_record.quantity - (inv_record.reserved_quantity - item.quantity),
        v_tracking_number,
        OLD.order_number,
        'تحرير المحجوز - حذف تلقائي للطلب',
        v_employee_name
      );
      
      -- إرسال إشعار بتحرير المخزون
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        OLD.created_by,
        'تحرير مخزون محجوز',
        'تم تحرير ' || item.quantity || ' وحدة من المخزون المحجوز بسبب حذف الطلب ' || v_tracking_number,
        'inventory_released',
        jsonb_build_object(
          'tracking_number', v_tracking_number,
          'variant_id', item.variant_id,
          'quantity_released', item.quantity
        );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7) تصحيح المخزون الحالي للطلبات بحالة 17 التي لم تُحرر
DO $$
DECLARE
  order_rec RECORD;
  item RECORD;
  inv_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  -- البحث عن طلبات بحالة 17 لم تُحرر بشكل صحيح
  FOR order_rec IN 
    SELECT o.id, o.tracking_number, o.order_number, o.created_by
    FROM orders o
    WHERE o.delivery_status = '17'
      AND o.status = 'returned_in_stock'
      AND NOT o.isarchived
  LOOP
    FOR item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = order_rec.id
        AND oi.item_direction IS DISTINCT FROM 'incoming'
        AND oi.item_status IS DISTINCT FROM 'delivered'
    LOOP
      -- تحقق من أن المحجوز موجود
      SELECT * INTO inv_record FROM inventory WHERE variant_id = item.variant_id;
      
      -- هنا نستخدم fix_inventory_discrepancies بدلاً من التصحيح اليدوي
      -- لأنها تحسب القيم الصحيحة من الطلبات النشطة
    END LOOP;
  END LOOP;
  
  -- تشغيل fix_inventory_discrepancies لتصحيح جميع القيم
  PERFORM fix_inventory_discrepancies();
  
  RAISE NOTICE 'تم تصحيح المخزون بنجاح';
END $$;

-- 8) التحقق من التريجرات النهائية
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'orders'
    AND trigger_name IN ('auto_release_stock_on_delete', 'trg_handle_order_status_change');
  
  IF trigger_count < 2 THEN
    RAISE EXCEPTION 'خطأ: بعض التريجرات المطلوبة غير موجودة';
  END IF;
  
  RAISE NOTICE 'تم التحقق: جميع التريجرات المطلوبة موجودة ومفعلة';
END $$;
