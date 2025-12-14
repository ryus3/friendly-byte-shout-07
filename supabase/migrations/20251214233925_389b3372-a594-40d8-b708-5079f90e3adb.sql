-- إصلاح trigger حذف الطلبات لإرسال الإشعارات وتسجيل العمليات بشكل صحيح
CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_value TEXT;
  v_tracking_number TEXT;
  v_old_reserved INT;
  v_new_reserved INT;
  v_old_quantity INT;
  v_old_available INT;
  v_new_available INT;
  v_old_sold INT;
BEGIN
  -- Get tracking number
  v_tracking_number := COALESCE(OLD.tracking_number, OLD.order_number);
  
  -- Only release stock for orders that have reserved quantities (not delivered/returned)
  -- delivery_status NOT IN ('4', '17') means stock was reserved
  IF OLD.delivery_status IS NULL OR OLD.delivery_status NOT IN ('4', '17') THEN
    
    -- Loop through order items
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.product_id
      FROM order_items oi
      WHERE oi.order_id = OLD.id
    LOOP
      -- Get product details
      SELECT 
        p.name,
        COALESCE(c.name, 'بدون لون'),
        COALESCE(s.value, 'بدون مقاس')
      INTO v_product_name, v_color_name, v_size_value
      FROM products p
      LEFT JOIN product_variants pv ON pv.id = item.variant_id
      LEFT JOIN colors c ON c.id = pv.color_id
      LEFT JOIN sizes s ON s.id = pv.size_id
      WHERE p.id = item.product_id;
      
      -- Get current inventory values
      SELECT reserved_quantity, quantity, sold_quantity
      INTO v_old_reserved, v_old_quantity, v_old_sold
      FROM inventory
      WHERE variant_id = item.variant_id;
      
      -- Calculate old available
      v_old_available := COALESCE(v_old_quantity, 0) - COALESCE(v_old_reserved, 0);
      
      -- Update inventory: decrease reserved_quantity ONLY (NOT quantity or sold_quantity)
      UPDATE inventory
      SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          updated_at = NOW()
      WHERE variant_id = item.variant_id;
      
      -- Get new values
      SELECT reserved_quantity INTO v_new_reserved
      FROM inventory WHERE variant_id = item.variant_id;
      
      v_new_available := COALESCE(v_old_quantity, 0) - COALESCE(v_new_reserved, 0);
      
      -- Log to product_tracking_log
      INSERT INTO product_tracking_log (
        variant_id, product_id, operation_type, source_type,
        quantity_change, stock_before, stock_after,
        reserved_before, reserved_after,
        available_before, available_after,
        sold_before, sold_after,
        tracking_number, reference_number, notes,
        created_by
      ) VALUES (
        item.variant_id, item.product_id, 'release_reserved', 'order_deleted',
        item.quantity, v_old_quantity, v_old_quantity,
        v_old_reserved, v_new_reserved,
        v_old_available, v_new_available,
        v_old_sold, v_old_sold,
        v_tracking_number, OLD.order_number, 
        'تحرير محجوز بسبب حذف الطلب',
        OLD.created_by
      );
      
      -- Log to inventory_operations_log
      INSERT INTO inventory_operations_log (
        variant_id, product_id, operation_type, source_type,
        quantity_change, stock_before, stock_after,
        reserved_before, reserved_after,
        available_before, available_after,
        sold_before, sold_after,
        tracking_number, reference_number, notes,
        created_by
      ) VALUES (
        item.variant_id, item.product_id, 'release_reserved', 'order_deleted',
        item.quantity, v_old_quantity, v_old_quantity,
        v_old_reserved, v_new_reserved,
        v_old_available, v_new_available,
        v_old_sold, v_old_sold,
        v_tracking_number, OLD.order_number, 
        'تحرير محجوز بسبب حذف الطلب - ' || COALESCE(v_product_name, 'منتج'),
        OLD.created_by
      );
      
      -- Send notification to order creator (fixed syntax)
      INSERT INTO notifications (user_id, title, message, type, data, priority)
      VALUES (
        OLD.created_by,
        'تم تحرير مخزون محجوز',
        'تم حذف الطلب ' || v_tracking_number || ' وتحرير ' || item.quantity || ' قطعة من ' || COALESCE(v_product_name, 'منتج'),
        'inventory_released',
        jsonb_build_object(
          'order_id', OLD.id,
          'order_number', OLD.order_number,
          'tracking_number', v_tracking_number,
          'variant_id', item.variant_id,
          'quantity_released', item.quantity,
          'product_name', v_product_name,
          'color', v_color_name,
          'size', v_size_value
        ),
        'medium'
      );
      
    END LOOP;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists and is enabled
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
CREATE TRIGGER auto_release_stock_on_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_order_delete();