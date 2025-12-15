-- 1. إصلاح دالة audit_inventory_accuracy بتغيير اسم variant_id
DROP FUNCTION IF EXISTS audit_inventory_accuracy();

CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE(
  inv_variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_reserved integer,
  calculated_reserved integer,
  current_sold integer,
  calculated_sold integer,
  current_quantity integer,
  available_quantity integer,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_orders_reserved AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as total_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.isarchived = false
      AND COALESCE(o.delivery_status, '0') NOT IN ('4', '17')
      AND COALESCE(o.order_type, 'normal') != 'return'
    GROUP BY oi.variant_id
  ),
  delivered_orders_sold AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as total_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (o.delivery_status = '4' OR o.status IN ('completed', 'delivered'))
      AND COALESCE(o.order_type, 'normal') != 'return'
    GROUP BY oi.variant_id
    
    UNION ALL
    
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as total_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_type = 'partial_delivery'
      AND oi.item_status = 'delivered'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  ),
  sold_aggregated AS (
    SELECT variant_id, SUM(total_sold)::integer as total_sold
    FROM delivered_orders_sold
    GROUP BY variant_id
  )
  SELECT 
    inv.variant_id as inv_variant_id,
    p.name as product_name,
    COALESCE(cl.name, 'بدون لون') as color_name,
    COALESCE(sz.value, 'بدون مقاس') as size_value,
    COALESCE(inv.reserved_quantity, 0)::integer as current_reserved,
    COALESCE(aor.total_reserved, 0)::integer as calculated_reserved,
    COALESCE(inv.sold_quantity, 0)::integer as current_sold,
    COALESCE(sa.total_sold, 0)::integer as calculated_sold,
    COALESCE(inv.quantity, 0)::integer as current_quantity,
    (COALESCE(inv.quantity, 0) - COALESCE(inv.reserved_quantity, 0))::integer as available_quantity,
    CASE 
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(aor.total_reserved, 0) 
           AND COALESCE(inv.sold_quantity, 0) != COALESCE(sa.total_sold, 0) THEN 'both'
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(aor.total_reserved, 0) THEN 'reserved'
      WHEN COALESCE(inv.sold_quantity, 0) != COALESCE(sa.total_sold, 0) THEN 'sold'
      ELSE 'ok'
    END as issue_type
  FROM inventory inv
  JOIN product_variants pv ON pv.id = inv.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors cl ON cl.id = pv.color_id
  LEFT JOIN sizes sz ON sz.id = pv.size_id
  LEFT JOIN active_orders_reserved aor ON aor.variant_id = inv.variant_id
  LEFT JOIN sold_aggregated sa ON sa.variant_id = inv.variant_id
  ORDER BY p.name, cl.name, sz.value;
END;
$$;

-- 2. إعادة إنشاء trigger الحذف التلقائي
DROP FUNCTION IF EXISTS auto_release_stock_on_order_delete() CASCADE;

CREATE OR REPLACE FUNCTION auto_release_stock_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  inv_record RECORD;
  v_user_name text;
BEGIN
  -- جلب اسم المستخدم
  SELECT full_name INTO v_user_name 
  FROM profiles 
  WHERE user_id = OLD.created_by;

  -- معالجة كل عنصر في الطلب
  FOR item IN 
    SELECT oi.variant_id, oi.quantity, p.name as product_name
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = OLD.id
  LOOP
    -- جلب بيانات المخزون الحالية
    SELECT * INTO inv_record FROM inventory WHERE variant_id = item.variant_id;
    
    IF inv_record IS NOT NULL THEN
      -- تحديث المخزون - تقليل المحجوز فقط
      UPDATE inventory
      SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          updated_at = NOW()
      WHERE variant_id = item.variant_id;
      
      -- تسجيل العملية في سجل التتبع
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
        employee_name,
        notes,
        created_at
      ) VALUES (
        item.variant_id,
        'release_reserved',
        'order_deleted',
        OLD.tracking_number,
        OLD.order_number,
        inv_record.quantity,
        inv_record.quantity,
        inv_record.reserved_quantity,
        GREATEST(0, inv_record.reserved_quantity - item.quantity),
        inv_record.sold_quantity,
        inv_record.sold_quantity,
        inv_record.quantity - inv_record.reserved_quantity,
        inv_record.quantity - GREATEST(0, inv_record.reserved_quantity - item.quantity),
        COALESCE(v_user_name, 'النظام'),
        'تحرير محجوز بسبب حذف الطلب: ' || COALESCE(OLD.tracking_number, OLD.order_number),
        NOW()
      );
    END IF;
  END LOOP;

  -- إنشاء إشعار بالحذف
  INSERT INTO notifications (
    type,
    title,
    message,
    user_id,
    data,
    priority,
    is_read
  ) VALUES (
    'order_deleted',
    'تم حذف طلب',
    'تم حذف الطلب رقم ' || COALESCE(OLD.tracking_number, OLD.order_number) || ' وتحرير المخزون المحجوز',
    OLD.created_by,
    jsonb_build_object(
      'order_id', OLD.id,
      'tracking_number', OLD.tracking_number,
      'order_number', OLD.order_number
    ),
    'medium',
    false
  );

  RETURN OLD;
END;
$$;

-- إنشاء الـ trigger
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
CREATE TRIGGER auto_release_stock_on_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_order_delete();

-- 3. إصلاح دالة fix_inventory_discrepancies لاستخدام الاسم الجديد
DROP FUNCTION IF EXISTS fix_inventory_discrepancies();

CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS TABLE(
  fixed_count integer,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed_count integer := 0;
  v_details jsonb := '[]'::jsonb;
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM audit_inventory_accuracy() WHERE issue_type != 'ok'
  LOOP
    -- تحديث المخزون
    UPDATE inventory
    SET 
      reserved_quantity = rec.calculated_reserved,
      sold_quantity = rec.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = rec.inv_variant_id;
    
    -- تسجيل العملية
    INSERT INTO inventory_operations_log (
      variant_id,
      operation_type,
      source_type,
      quantity_change,
      notes,
      created_at
    ) VALUES (
      rec.inv_variant_id,
      'audit_correction',
      'audit',
      0,
      'تصحيح: محجوز ' || rec.current_reserved || '→' || rec.calculated_reserved || 
      ', مباع ' || rec.current_sold || '→' || rec.calculated_sold,
      NOW()
    );
    
    v_fixed_count := v_fixed_count + 1;
    v_details := v_details || jsonb_build_object(
      'product', rec.product_name,
      'color', rec.color_name,
      'size', rec.size_value,
      'issue', rec.issue_type
    );
  END LOOP;
  
  RETURN QUERY SELECT v_fixed_count, v_details;
END;
$$;