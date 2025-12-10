
-- حذف الدوال القديمة أولاً
DROP FUNCTION IF EXISTS audit_inventory_accuracy();
DROP FUNCTION IF EXISTS fix_inventory_discrepancies();

-- =============================================
-- المرحلة 1: حذف الـ Triggers المتضاربة
-- =============================================

DROP TRIGGER IF EXISTS trigger_auto_partial_delivery_inventory ON order_items;
DROP FUNCTION IF EXISTS auto_update_inventory_on_partial_delivery();

DROP TRIGGER IF EXISTS update_reserved_on_order_item_change ON order_items;
DROP FUNCTION IF EXISTS update_reserved_on_order_item_change();

-- =============================================
-- المرحلة 2: تحسين جدول تتبع المنتجات
-- =============================================

ALTER TABLE product_tracking_log 
ADD COLUMN IF NOT EXISTS stock_before INTEGER,
ADD COLUMN IF NOT EXISTS stock_after INTEGER,
ADD COLUMN IF NOT EXISTS reserved_before INTEGER,
ADD COLUMN IF NOT EXISTS reserved_after INTEGER,
ADD COLUMN IF NOT EXISTS sold_before INTEGER,
ADD COLUMN IF NOT EXISTS sold_after INTEGER,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS available_before INTEGER,
ADD COLUMN IF NOT EXISTS available_after INTEGER;

-- =============================================
-- المرحلة 3: دالة فحص دقة المخزون
-- =============================================

CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE (
  variant_id UUID,
  product_name TEXT,
  color_name TEXT,
  size_name TEXT,
  current_quantity INTEGER,
  current_reserved INTEGER,
  current_sold INTEGER,
  current_available INTEGER,
  calculated_reserved INTEGER,
  calculated_sold INTEGER,
  reserved_diff INTEGER,
  sold_diff INTEGER,
  has_issue BOOLEAN,
  issue_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  active_reservations AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) AS reserved_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE 
      COALESCE(o.delivery_status, '0') NOT IN ('4', '17')
      AND COALESCE(o.isarchived, false) = false
      AND NOT (COALESCE(o.order_type, '') = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'incoming')
      AND NOT (COALESCE(o.order_type, '') = 'partial_delivery' AND COALESCE(oi.item_status, '') = 'delivered')
    GROUP BY oi.variant_id
  ),
  sold_items AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) AS sold_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE 
      (COALESCE(o.delivery_status, '0') = '4' AND COALESCE(o.order_type, '') NOT IN ('return', 'partial_delivery') AND COALESCE(oi.item_direction, 'outgoing') != 'incoming')
      OR (COALESCE(o.order_type, '') = 'partial_delivery' AND COALESCE(oi.item_status, '') = 'delivered' AND COALESCE(oi.item_direction, 'outgoing') != 'incoming')
    GROUP BY oi.variant_id
  )
  SELECT 
    i.variant_id,
    p.name AS product_name,
    c.name AS color_name,
    pv.size AS size_name,
    i.quantity AS current_quantity,
    i.reserved_quantity AS current_reserved,
    i.sold_quantity AS current_sold,
    (i.quantity - i.reserved_quantity) AS current_available,
    COALESCE(ar.reserved_qty, 0)::INTEGER AS calculated_reserved,
    COALESCE(si.sold_qty, 0)::INTEGER AS calculated_sold,
    (i.reserved_quantity - COALESCE(ar.reserved_qty, 0))::INTEGER AS reserved_diff,
    (i.sold_quantity - COALESCE(si.sold_qty, 0))::INTEGER AS sold_diff,
    (i.reserved_quantity != COALESCE(ar.reserved_qty, 0) OR i.sold_quantity != COALESCE(si.sold_qty, 0) OR (i.quantity - i.reserved_quantity) < 0) AS has_issue,
    CASE 
      WHEN (i.quantity - i.reserved_quantity) < 0 THEN 'متاح سالب'
      WHEN i.reserved_quantity != COALESCE(ar.reserved_qty, 0) AND i.sold_quantity != COALESCE(si.sold_qty, 0) THEN 'خطأ في المحجوز والمباع'
      WHEN i.reserved_quantity != COALESCE(ar.reserved_qty, 0) THEN 'خطأ في المحجوز'
      WHEN i.sold_quantity != COALESCE(si.sold_qty, 0) THEN 'خطأ في المباع'
      ELSE 'صحيح'
    END AS issue_type
  FROM inventory i
  JOIN product_variants pv ON pv.id = i.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN active_reservations ar ON ar.variant_id = i.variant_id
  LEFT JOIN sold_items si ON si.variant_id = i.variant_id
  ORDER BY has_issue DESC, p.name, c.name, pv.size;
END;
$$;

-- =============================================
-- المرحلة 4: دالة تصحيح المخزون
-- =============================================

CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS TABLE (
  variant_id UUID,
  product_name TEXT,
  color_name TEXT,
  size_name TEXT,
  old_reserved INTEGER,
  new_reserved INTEGER,
  old_sold INTEGER,
  new_sold INTEGER,
  fixed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_old_reserved INTEGER;
  v_old_sold INTEGER;
  v_new_reserved INTEGER;
  v_new_sold INTEGER;
BEGIN
  FOR rec IN SELECT * FROM audit_inventory_accuracy() WHERE has_issue = true
  LOOP
    SELECT i.reserved_quantity, i.sold_quantity INTO v_old_reserved, v_old_sold
    FROM inventory i WHERE i.variant_id = rec.variant_id;
    
    v_new_reserved := rec.calculated_reserved;
    v_new_sold := rec.calculated_sold;
    
    UPDATE inventory i SET 
      reserved_quantity = v_new_reserved,
      sold_quantity = v_new_sold,
      updated_at = NOW()
    WHERE i.variant_id = rec.variant_id;
    
    INSERT INTO product_tracking_log (variant_id, operation_type, quantity_change, quantity_before, quantity_after, reserved_before, reserved_after, sold_before, sold_after, stock_before, stock_after, notes, source_type, created_at)
    VALUES (rec.variant_id, 'inventory_fix', 0, rec.current_quantity, rec.current_quantity, v_old_reserved, v_new_reserved, v_old_sold, v_new_sold, rec.current_quantity, rec.current_quantity, 'إصلاح تلقائي - المحجوز: ' || v_old_reserved || ' → ' || v_new_reserved || ' | المباع: ' || v_old_sold || ' → ' || v_new_sold, 'system', NOW());
    
    variant_id := rec.variant_id;
    product_name := rec.product_name;
    color_name := rec.color_name;
    size_name := rec.size_name;
    old_reserved := v_old_reserved;
    new_reserved := v_new_reserved;
    old_sold := v_old_sold;
    new_sold := v_new_sold;
    fixed := true;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- =============================================
-- المرحلة 5: trigger التسليم الجزئي
-- =============================================

CREATE OR REPLACE FUNCTION handle_unified_partial_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_type TEXT;
  v_item_direction TEXT;
  v_old_status TEXT;
  v_new_status TEXT;
  v_quantity INTEGER;
  v_current_qty INTEGER;
  v_current_reserved INTEGER;
  v_current_sold INTEGER;
BEGIN
  SELECT order_type INTO v_order_type FROM orders WHERE id = NEW.order_id;
  
  IF COALESCE(v_order_type, '') != 'partial_delivery' THEN
    RETURN NEW;
  END IF;
  
  v_item_direction := COALESCE(NEW.item_direction, 'outgoing');
  v_old_status := COALESCE(OLD.item_status, '');
  v_new_status := COALESCE(NEW.item_status, '');
  v_quantity := COALESCE(NEW.quantity, 1);
  
  SELECT quantity, reserved_quantity, sold_quantity INTO v_current_qty, v_current_reserved, v_current_sold
  FROM inventory WHERE variant_id = NEW.variant_id;
  
  IF v_new_status = 'delivered' AND v_old_status != 'delivered' AND v_item_direction = 'outgoing' THEN
    UPDATE inventory SET 
      quantity = quantity - v_quantity,
      reserved_quantity = GREATEST(0, reserved_quantity - v_quantity),
      sold_quantity = sold_quantity + v_quantity,
      updated_at = NOW()
    WHERE variant_id = NEW.variant_id;
    
    INSERT INTO product_tracking_log (variant_id, operation_type, quantity_change, stock_before, stock_after, reserved_before, reserved_after, sold_before, sold_after, notes, source_type, reference_id, tracking_number, created_at)
    SELECT NEW.variant_id, 'partial_delivery_sold', -v_quantity, v_current_qty, v_current_qty - v_quantity, v_current_reserved, GREATEST(0, v_current_reserved - v_quantity), v_current_sold, v_current_sold + v_quantity, 'تسليم جزئي - مباع: ' || v_quantity || ' قطعة', 'order', NEW.order_id, o.tracking_number, NOW()
    FROM orders o WHERE o.id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unified_partial_delivery_trigger ON order_items;
CREATE TRIGGER unified_partial_delivery_trigger
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_unified_partial_delivery();

-- =============================================
-- المرحلة 6: trigger الطلبات الموحد
-- =============================================

CREATE OR REPLACE FUNCTION handle_unified_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_old_status TEXT;
  v_new_status TEXT;
  v_order_type TEXT;
  v_current_qty INTEGER;
  v_current_reserved INTEGER;
  v_current_sold INTEGER;
BEGIN
  v_old_status := COALESCE(OLD.delivery_status, '0');
  v_new_status := COALESCE(NEW.delivery_status, '0');
  v_order_type := COALESCE(NEW.order_type, '');
  
  IF v_order_type = 'partial_delivery' THEN
    RETURN NEW;
  END IF;
  
  IF v_new_status = '4' AND v_old_status != '4' THEN
    FOR item IN SELECT oi.variant_id, oi.quantity, COALESCE(oi.item_direction, 'outgoing') as direction FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      IF item.direction = 'outgoing' THEN
        SELECT quantity, reserved_quantity, sold_quantity INTO v_current_qty, v_current_reserved, v_current_sold FROM inventory WHERE variant_id = item.variant_id;
        
        UPDATE inventory SET 
          quantity = quantity - item.quantity,
          reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          sold_quantity = sold_quantity + item.quantity,
          updated_at = NOW()
        WHERE variant_id = item.variant_id;
        
        INSERT INTO product_tracking_log (variant_id, operation_type, quantity_change, stock_before, stock_after, reserved_before, reserved_after, sold_before, sold_after, notes, source_type, reference_id, tracking_number, created_at)
        VALUES (item.variant_id, 'order_delivered', -item.quantity, v_current_qty, v_current_qty - item.quantity, v_current_reserved, GREATEST(0, v_current_reserved - item.quantity), v_current_sold, v_current_sold + item.quantity, 'طلب مسلم - مباع: ' || item.quantity || ' قطعة', 'order', NEW.id, NEW.tracking_number, NOW());
      END IF;
    END LOOP;
  
  ELSIF v_new_status = '17' AND v_old_status != '17' THEN
    FOR item IN SELECT oi.variant_id, oi.quantity, COALESCE(oi.item_direction, 'outgoing') as direction FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      IF item.direction = 'outgoing' THEN
        SELECT quantity, reserved_quantity, sold_quantity INTO v_current_qty, v_current_reserved, v_current_sold FROM inventory WHERE variant_id = item.variant_id;
        
        UPDATE inventory SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity), updated_at = NOW() WHERE variant_id = item.variant_id;
        
        INSERT INTO product_tracking_log (variant_id, operation_type, quantity_change, stock_before, stock_after, reserved_before, reserved_after, sold_before, sold_after, notes, source_type, reference_id, tracking_number, created_at)
        VALUES (item.variant_id, 'order_returned', 0, v_current_qty, v_current_qty, v_current_reserved, GREATEST(0, v_current_reserved - item.quantity), v_current_sold, v_current_sold, 'طلب مرجع للمخزن - تحرير المحجوز: ' || item.quantity || ' قطعة', 'order', NEW.id, NEW.tracking_number, NOW());
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unified_inventory_trigger ON orders;
CREATE TRIGGER unified_inventory_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_unified_inventory();
