-- إصلاح الـ function لاستخدام الأعمدة الصحيحة
CREATE OR REPLACE FUNCTION update_sold_quantity_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_inv RECORD;
BEGIN
  -- فقط عند التسليم (delivery_status = 4) ولم يُسجل سابقاً
  IF NEW.delivery_status = '4' 
     AND (OLD.delivery_status IS NULL OR OLD.delivery_status IS DISTINCT FROM '4')
     AND COALESCE(NEW.sold_recorded, false) = false
     AND COALESCE(NEW.order_type, '') != 'return'
  THEN
    FOR v_item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.variant_id IS NOT NULL
        AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
        AND COALESCE(oi.item_status, '') != 'delivered'
    LOOP
      -- الحصول على القيم الحالية
      SELECT * INTO v_inv FROM inventory WHERE variant_id = v_item.variant_id;
      
      IF v_inv IS NOT NULL THEN
        -- تحديث المخزون
        UPDATE inventory
        SET 
          sold_quantity = COALESCE(sold_quantity, 0) + v_item.quantity,
          reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - v_item.quantity),
          updated_at = NOW()
        WHERE variant_id = v_item.variant_id;
        
        -- تسجيل العملية بالأعمدة الصحيحة
        INSERT INTO inventory_operations_log (
          variant_id, operation_type, quantity_change, 
          quantity_before, quantity_after,
          reserved_before, reserved_after,
          sold_before, sold_after,
          source_type, order_id, tracking_number, 
          notes, performed_at
        ) VALUES (
          v_item.variant_id, 'sale', v_item.quantity,
          COALESCE(v_inv.quantity, 0), COALESCE(v_inv.quantity, 0),
          COALESCE(v_inv.reserved_quantity, 0), GREATEST(0, COALESCE(v_inv.reserved_quantity, 0) - v_item.quantity),
          COALESCE(v_inv.sold_quantity, 0), COALESCE(v_inv.sold_quantity, 0) + v_item.quantity,
          'order_delivery', NEW.id, NEW.tracking_number,
          'تسليم طلب تلقائي', NOW()
        );
      END IF;
    END LOOP;
    
    NEW.sold_recorded := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;