-- 1) حذف Trigger المكرر
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON orders;

-- 2) إصلاح دالة handle_order_status_change - إزالة NEW.direction
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_inv RECORD;
  v_color_name TEXT;
  v_size_value TEXT;
BEGIN
  -- تجاهل الطلبات المؤرشفة
  IF NEW.isarchived = true THEN
    RETURN NEW;
  END IF;

  -- تجاهل طلبات الإرجاع الواردة (فحص من order_items بدلاً من NEW.direction)
  IF NEW.order_type = 'return' THEN
    IF EXISTS (SELECT 1 FROM order_items WHERE order_id = NEW.id AND item_direction = 'incoming') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- تجاهل التسليم الجزئي المكتمل
  IF NEW.order_type = 'partial_delivery' AND NEW.is_partial_delivery_completed = true THEN
    RETURN NEW;
  END IF;

  -- منع التكرار باستخدام sold_recorded
  IF NEW.sold_recorded = true THEN
    RETURN NEW;
  END IF;

  -- عند التسليم (delivery_status = '4')
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    FOR item IN 
      SELECT oi.*, pv.id as variant_id, p.name as product_name
      FROM order_items oi
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE oi.order_id = NEW.id
    LOOP
      -- جلب المخزون الحالي
      SELECT * INTO v_inv FROM inventory WHERE variant_id = item.variant_id;
      
      IF v_inv IS NOT NULL AND v_inv.reserved_quantity >= item.quantity THEN
        -- جلب اسم اللون والقياس
        SELECT COALESCE(c.name, 'بدون لون') INTO v_color_name
        FROM product_variants pv
        LEFT JOIN colors c ON c.id = pv.color_id
        WHERE pv.id = item.variant_id;

        SELECT COALESCE(sz.value, 'بدون قياس') INTO v_size_value
        FROM product_variants pv
        LEFT JOIN sizes sz ON sz.id = pv.size_id
        WHERE pv.id = item.variant_id;

        -- تسجيل في سجل التتبع
        INSERT INTO product_tracking_log (
          variant_id, operation_type, quantity_change,
          stock_before, stock_after,
          reserved_before, reserved_after,
          sold_before, sold_after,
          available_before, available_after,
          source_type, reference_number, tracking_number,
          product_name, color_name, size_value, notes
        ) VALUES (
          item.variant_id, 'sold', item.quantity,
          v_inv.quantity, v_inv.quantity - item.quantity,
          v_inv.reserved_quantity, v_inv.reserved_quantity - item.quantity,
          COALESCE(v_inv.sold_quantity, 0), COALESCE(v_inv.sold_quantity, 0) + item.quantity,
          v_inv.quantity - v_inv.reserved_quantity, (v_inv.quantity - item.quantity) - (v_inv.reserved_quantity - item.quantity),
          'order_delivery', NEW.order_number, NEW.tracking_number,
          item.product_name, v_color_name, v_size_value, 'تسليم طلب - تحويل محجوز إلى مباع'
        );

        -- تحديث المخزون
        UPDATE inventory SET
          quantity = quantity - item.quantity,
          reserved_quantity = reserved_quantity - item.quantity,
          sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
          updated_at = NOW()
        WHERE variant_id = item.variant_id;
      END IF;
    END LOOP;

    -- تحديث sold_recorded و status
    NEW.sold_recorded := true;
    NEW.status := 'completed';
    RETURN NEW;
  END IF;

  -- عند الإرجاع للتاجر (delivery_status = '17')
  IF NEW.delivery_status = '17' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '17') THEN
    FOR item IN 
      SELECT oi.*, pv.id as variant_id, p.name as product_name
      FROM order_items oi
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE oi.order_id = NEW.id
      AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned'))
    LOOP
      SELECT * INTO v_inv FROM inventory WHERE variant_id = item.variant_id;
      
      IF v_inv IS NOT NULL AND v_inv.reserved_quantity >= item.quantity THEN
        SELECT COALESCE(c.name, 'بدون لون') INTO v_color_name
        FROM product_variants pv
        LEFT JOIN colors c ON c.id = pv.color_id
        WHERE pv.id = item.variant_id;

        SELECT COALESCE(sz.value, 'بدون قياس') INTO v_size_value
        FROM product_variants pv
        LEFT JOIN sizes sz ON sz.id = pv.size_id
        WHERE pv.id = item.variant_id;

        INSERT INTO product_tracking_log (
          variant_id, operation_type, quantity_change,
          stock_before, stock_after,
          reserved_before, reserved_after,
          sold_before, sold_after,
          available_before, available_after,
          source_type, reference_number, tracking_number,
          product_name, color_name, size_value, notes
        ) VALUES (
          item.variant_id, 'release_reserved', item.quantity,
          v_inv.quantity, v_inv.quantity,
          v_inv.reserved_quantity, v_inv.reserved_quantity - item.quantity,
          COALESCE(v_inv.sold_quantity, 0), COALESCE(v_inv.sold_quantity, 0),
          v_inv.quantity - v_inv.reserved_quantity, v_inv.quantity - (v_inv.reserved_quantity - item.quantity),
          'order_return', NEW.order_number, NEW.tracking_number,
          item.product_name, v_color_name, v_size_value, 'إرجاع للتاجر - تحرير محجوز فقط'
        );

        UPDATE inventory SET
          reserved_quantity = reserved_quantity - item.quantity,
          updated_at = NOW()
        WHERE variant_id = item.variant_id;

        -- إشعار تحرير المخزون
        INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
        VALUES (
          NEW.created_by,
          'تحرير مخزون',
          'تم تحرير ' || item.quantity || ' من ' || item.product_name || ' (' || v_color_name || ' - ' || v_size_value || ') - رقم التتبع: ' || COALESCE(NEW.tracking_number, 'غير محدد'),
          'inventory_released',
          NEW.id,
          'order'
        );
      END IF;
    END LOOP;

    -- تحديث حالة الطلب بناءً على النوع
    IF NEW.order_type = 'partial_delivery' THEN
      NEW.status := 'returned';
    ELSE
      NEW.status := 'returned_in_stock';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) إصلاح دالة الحذف التلقائي
CREATE OR REPLACE FUNCTION public.auto_release_stock_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_inv RECORD;
  v_color_name TEXT;
  v_size_value TEXT;
  v_product_details TEXT := '';
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

  FOR item IN 
    SELECT oi.*, pv.id as variant_id, p.name as product_name
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = OLD.id
  LOOP
    SELECT * INTO v_inv FROM inventory WHERE variant_id = item.variant_id;
    
    IF v_inv IS NOT NULL AND v_inv.reserved_quantity >= item.quantity THEN
      -- جلب اسم اللون
      SELECT COALESCE(c.name, 'بدون لون') INTO v_color_name
      FROM product_variants pv
      LEFT JOIN colors c ON c.id = pv.color_id
      WHERE pv.id = item.variant_id;

      -- جلب القياس
      SELECT COALESCE(sz.value, 'بدون قياس') INTO v_size_value
      FROM product_variants pv
      LEFT JOIN sizes sz ON sz.id = pv.size_id
      WHERE pv.id = item.variant_id;

      -- تسجيل في سجل التتبع
      INSERT INTO product_tracking_log (
        variant_id, operation_type, quantity_change,
        stock_before, stock_after,
        reserved_before, reserved_after,
        sold_before, sold_after,
        available_before, available_after,
        source_type, reference_number, tracking_number,
        product_name, color_name, size_value, notes
      ) VALUES (
        item.variant_id, 'release_reserved', item.quantity,
        v_inv.quantity, v_inv.quantity,
        v_inv.reserved_quantity, v_inv.reserved_quantity - item.quantity,
        COALESCE(v_inv.sold_quantity, 0), COALESCE(v_inv.sold_quantity, 0),
        v_inv.quantity - v_inv.reserved_quantity, v_inv.quantity - (v_inv.reserved_quantity - item.quantity),
        'order_delete', OLD.order_number, OLD.tracking_number,
        item.product_name, v_color_name, v_size_value, 'حذف طلب - تحرير محجوز'
      );

      -- تحديث المخزون
      UPDATE inventory SET
        reserved_quantity = reserved_quantity - item.quantity,
        updated_at = NOW()
      WHERE variant_id = item.variant_id;

      -- بناء تفاصيل المنتج للإشعار
      v_product_details := v_product_details || item.product_name || ' (' || v_color_name || ' - ' || v_size_value || ') x' || item.quantity || E'\n';
    END IF;
  END LOOP;

  -- إرسال إشعار واحد بكل المنتجات
  IF v_product_details != '' THEN
    INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
    VALUES (
      OLD.created_by,
      'تحرير مخزون - حذف طلب',
      'تم تحرير المخزون للطلب ' || COALESCE(OLD.tracking_number, OLD.order_number) || E':\n' || v_product_details,
      'inventory_released',
      OLD.id,
      'order'
    );
  END IF;

  RETURN OLD;
END;
$$;

-- التأكد من وجود trigger واحد فقط للحذف
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
CREATE TRIGGER auto_release_stock_on_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_delete();