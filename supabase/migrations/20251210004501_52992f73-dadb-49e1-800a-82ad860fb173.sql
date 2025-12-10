-- حذف Triggers القديمة
DROP TRIGGER IF EXISTS trg_update_sold_on_delivery ON orders;
DROP TRIGGER IF EXISTS update_sold_on_partial_delivery ON order_items;
DROP TRIGGER IF EXISTS handle_order_status_change_trigger ON orders;
DROP TRIGGER IF EXISTS auto_stock_management_trigger ON orders;
DROP TRIGGER IF EXISTS update_order_reservation_status_trigger ON orders;
DROP TRIGGER IF EXISTS unified_inventory_trigger ON orders;
DROP TRIGGER IF EXISTS unified_partial_delivery_trigger ON order_items;

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS handle_order_status_change() CASCADE;
DROP FUNCTION IF EXISTS update_sold_on_partial_delivery() CASCADE;
DROP FUNCTION IF EXISTS auto_stock_management() CASCADE;
DROP FUNCTION IF EXISTS unified_inventory_handler() CASCADE;
DROP FUNCTION IF EXISTS unified_partial_delivery_handler() CASCADE;

-- إنشاء الدالة الموحدة للمخزون
CREATE OR REPLACE FUNCTION unified_inventory_handler()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
BEGIN
  -- للحذف: تحرير المخزون المحجوز
  IF TG_OP = 'DELETE' THEN
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.unit_price
      FROM order_items oi
      WHERE oi.order_id = OLD.id
        AND oi.item_direction IS DISTINCT FROM 'incoming'
    LOOP
      UPDATE inventory 
      SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity)
      WHERE variant_id = item.variant_id;
      
      INSERT INTO product_tracking_log (
        variant_id, order_id, operation_type, quantity,
        unit_price, order_status, delivery_status, customer_name
      ) VALUES (
        item.variant_id, OLD.id, 'stock_released_on_delete', item.quantity,
        item.unit_price, OLD.status, OLD.delivery_status, OLD.customer_name
      );
    END LOOP;
    RETURN OLD;
  END IF;

  -- للتحديث: القاعدة الذهبية
  IF TG_OP = 'UPDATE' THEN
    -- تغيير إلى حالة 4 (مسلم = مباع)
    IF OLD.delivery_status IS DISTINCT FROM '4' AND NEW.delivery_status = '4' THEN
      FOR item IN 
        SELECT oi.variant_id, oi.quantity, oi.unit_price
        FROM order_items oi
        WHERE oi.order_id = NEW.id
          AND oi.item_direction IS DISTINCT FROM 'incoming'
          AND oi.item_status IS DISTINCT FROM 'delivered'
      LOOP
        UPDATE inventory 
        SET 
          reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          quantity = GREATEST(0, quantity - item.quantity),
          sold_quantity = sold_quantity + item.quantity
        WHERE variant_id = item.variant_id;
        
        INSERT INTO product_tracking_log (
          variant_id, order_id, operation_type, quantity,
          unit_price, order_status, delivery_status, customer_name
        ) VALUES (
          item.variant_id, NEW.id, 'sold', item.quantity,
          item.unit_price, NEW.status, NEW.delivery_status, NEW.customer_name
        );
      END LOOP;
      RETURN NEW;
    END IF;
    
    -- تغيير إلى حالة 17 (رجع للتاجر)
    IF OLD.delivery_status IS DISTINCT FROM '17' AND NEW.delivery_status = '17' THEN
      FOR item IN 
        SELECT oi.variant_id, oi.quantity, oi.unit_price
        FROM order_items oi
        WHERE oi.order_id = NEW.id
          AND oi.item_direction IS DISTINCT FROM 'incoming'
      LOOP
        UPDATE inventory 
        SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity)
        WHERE variant_id = item.variant_id;
        
        INSERT INTO product_tracking_log (
          variant_id, order_id, operation_type, quantity,
          unit_price, order_status, delivery_status, customer_name
        ) VALUES (
          item.variant_id, NEW.id, 'stock_released_returned', item.quantity,
          item.unit_price, NEW.status, NEW.delivery_status, NEW.customer_name
        );
      END LOOP;
      RETURN NEW;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء دالة التسليم الجزئي
CREATE OR REPLACE FUNCTION unified_partial_delivery_handler()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' 
    AND OLD.item_status IS DISTINCT FROM 'delivered' 
    AND NEW.item_status = 'delivered' 
  THEN
    IF EXISTS (
      SELECT 1 FROM orders 
      WHERE id = NEW.order_id 
      AND order_type = 'partial_delivery'
    ) THEN
      UPDATE inventory 
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - NEW.quantity),
        quantity = GREATEST(0, quantity - NEW.quantity),
        sold_quantity = sold_quantity + NEW.quantity
      WHERE variant_id = NEW.variant_id;
      
      INSERT INTO product_tracking_log (
        variant_id, order_id, operation_type, quantity,
        unit_price, order_status, delivery_status, customer_name
      ) 
      SELECT 
        NEW.variant_id, NEW.order_id, 'partial_delivery_sold', NEW.quantity,
        NEW.unit_price, o.status, o.delivery_status, o.customer_name
      FROM orders o
      WHERE o.id = NEW.order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء Triggers
CREATE TRIGGER unified_inventory_trigger
AFTER UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION unified_inventory_handler();

CREATE TRIGGER unified_partial_delivery_trigger
AFTER UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION unified_partial_delivery_handler();