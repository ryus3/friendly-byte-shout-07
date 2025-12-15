-- 1️⃣ حذف الدوال القديمة
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies();

-- 2️⃣ إعادة إنشاء audit_inventory_accuracy مع الإصلاحات
CREATE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
  inv_variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_reserved integer,
  calculated_reserved bigint,
  reserved_diff bigint,
  current_sold integer,
  calculated_sold bigint,
  sold_diff bigint,
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
      SUM(oi.quantity) as total_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.isarchived = false
      AND COALESCE(o.delivery_status, '0') NOT IN ('4', '17')
      AND COALESCE(o.order_type, 'normal') != 'return'
      AND COALESCE(oi.item_status, 'pending') != 'delivered'
    GROUP BY oi.variant_id
  ),
  delivered_orders_sold AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) as total_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (
      (COALESCE(o.delivery_status, '0') = '4' OR o.status IN ('completed', 'delivered'))
      OR
      (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    )
    AND COALESCE(o.order_type, 'normal') != 'return'
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  )
  SELECT 
    inv.variant_id as inv_variant_id,
    p.name::text as product_name,
    COALESCE(c.name, 'بدون لون')::text as color_name,
    COALESCE(s.name, 'بدون قياس')::text as size_value,
    COALESCE(inv.reserved_quantity, 0) as current_reserved,
    COALESCE(aor.total_reserved, 0) as calculated_reserved,
    COALESCE(aor.total_reserved, 0) - COALESCE(inv.reserved_quantity, 0) as reserved_diff,
    COALESCE(inv.sold_quantity, 0) as current_sold,
    COALESCE(dos.total_sold, 0) as calculated_sold,
    COALESCE(dos.total_sold, 0) - COALESCE(inv.sold_quantity, 0) as sold_diff,
    CASE 
      WHEN COALESCE(aor.total_reserved, 0) != COALESCE(inv.reserved_quantity, 0) 
           AND COALESCE(dos.total_sold, 0) != COALESCE(inv.sold_quantity, 0) THEN 'both'
      WHEN COALESCE(aor.total_reserved, 0) != COALESCE(inv.reserved_quantity, 0) THEN 'reserved'
      WHEN COALESCE(dos.total_sold, 0) != COALESCE(inv.sold_quantity, 0) THEN 'sold'
      ELSE 'ok'
    END as issue_type
  FROM inventory inv
  JOIN product_variants pv ON pv.id = inv.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  LEFT JOIN active_orders_reserved aor ON aor.variant_id = inv.variant_id
  LEFT JOIN delivered_orders_sold dos ON dos.variant_id = inv.variant_id
  WHERE COALESCE(aor.total_reserved, 0) != COALESCE(inv.reserved_quantity, 0)
     OR COALESCE(dos.total_sold, 0) != COALESCE(inv.sold_quantity, 0);
END;
$$;

-- 3️⃣ إعادة إنشاء fix_inventory_discrepancies مع اسم العمود الصحيح
CREATE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE(
  fixed_variant_id uuid,
  fixed_product_name text,
  old_reserved integer,
  new_reserved bigint,
  old_sold integer,
  new_sold bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM audit_inventory_accuracy() WHERE issue_type != 'ok'
  LOOP
    UPDATE inventory
    SET 
      reserved_quantity = rec.calculated_reserved,
      sold_quantity = rec.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = rec.inv_variant_id;
    
    INSERT INTO inventory_operations_log (
      variant_id, operation_type, source_type, quantity_change, notes, created_at
    ) VALUES (
      rec.inv_variant_id, 'audit_correction', 'audit', 0, 
      'تصحيح: المحجوز من ' || rec.current_reserved || ' إلى ' || rec.calculated_reserved || 
      ', المباع من ' || rec.current_sold || ' إلى ' || rec.calculated_sold,
      NOW()
    );
    
    fixed_variant_id := rec.inv_variant_id;
    fixed_product_name := rec.product_name;
    old_reserved := rec.current_reserved;
    new_reserved := rec.calculated_reserved;
    old_sold := rec.current_sold;
    new_sold := rec.calculated_sold;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 4️⃣ إصلاح trigger الحذف ليرسل إشعار بالصيغة الصحيحة
CREATE OR REPLACE FUNCTION public.auto_release_stock_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  inv_record RECORD;
  total_released INTEGER := 0;
  released_products TEXT := '';
BEGIN
  IF OLD.delivery_status IN ('4', '17') THEN
    RETURN OLD;
  END IF;

  FOR item IN 
    SELECT oi.variant_id, oi.quantity, p.name as product_name
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = OLD.id
      AND COALESCE(oi.item_status, 'pending') != 'delivered'
  LOOP
    SELECT * INTO inv_record FROM inventory WHERE variant_id = item.variant_id;
    
    IF inv_record IS NOT NULL AND inv_record.reserved_quantity > 0 THEN
      UPDATE inventory 
      SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
          updated_at = NOW()
      WHERE variant_id = item.variant_id;
      
      INSERT INTO product_tracking_log (
        variant_id, operation_type, source_type,
        stock_before, stock_after,
        reserved_before, reserved_after,
        sold_before, sold_after,
        available_before, available_after,
        tracking_number, notes, created_at
      ) VALUES (
        item.variant_id, 'release_reserved', 'order_deleted',
        inv_record.quantity, inv_record.quantity,
        inv_record.reserved_quantity, GREATEST(0, inv_record.reserved_quantity - item.quantity),
        inv_record.sold_quantity, inv_record.sold_quantity,
        inv_record.quantity - inv_record.reserved_quantity,
        inv_record.quantity - GREATEST(0, inv_record.reserved_quantity - item.quantity),
        OLD.tracking_number, 'تحرير تلقائي عند حذف الطلب', NOW()
      );
      
      total_released := total_released + item.quantity;
      
      IF released_products != '' THEN
        released_products := released_products || '، ';
      END IF;
      released_products := released_products || item.quantity || ' قطعة من ' || item.product_name;
    END IF;
  END LOOP;

  IF total_released > 0 THEN
    INSERT INTO notifications (type, title, message, user_id, created_at, is_read)
    VALUES (
      'inventory_released',
      'تم تحرير مخزون محجوز',
      'تم حذف الطلب ' || COALESCE(OLD.tracking_number, OLD.order_number) || ' وتحرير ' || released_products,
      OLD.created_by,
      NOW(),
      false
    );
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON orders;
CREATE TRIGGER auto_release_stock_on_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_release_stock_on_order_delete();

-- 5️⃣ تشغيل التصحيح
SELECT * FROM fix_inventory_discrepancies();