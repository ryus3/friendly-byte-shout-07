-- ========================================
-- خطة الإصلاح الشاملة للمخزون والإشعارات
-- ========================================

-- حذف الدوال القديمة أولاً
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy() CASCADE;
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies() CASCADE;

-- إنشاء دالة audit_inventory_accuracy الجديدة
CREATE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
  product_id uuid,
  variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_quantity integer,
  current_reserved integer,
  current_sold integer,
  calculated_reserved integer,
  calculated_sold integer,
  reserved_difference integer,
  sold_difference integer,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH calculated_reserved AS (
    SELECT 
      oi.variant_id as var_id,
      COALESCE(SUM(oi.quantity), 0)::integer as reserved_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND o.isarchived = false
      AND COALESCE(o.order_type, 'normal') != 'return'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
      AND COALESCE(oi.item_status, 'pending') != 'delivered'
    GROUP BY oi.variant_id
  ),
  calculated_sold AS (
    SELECT 
      oi.variant_id as var_id,
      COALESCE(SUM(oi.quantity), 0)::integer as sold_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE (
      (o.delivery_status = '4' AND COALESCE(o.order_type, 'normal') != 'return')
      OR (COALESCE(o.order_type, 'normal') = 'partial_delivery' AND oi.item_status = 'delivered')
    )
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  )
  SELECT 
    inv.product_id,
    inv.variant_id,
    p.name::text as product_name,
    COALESCE(c.name, 'بدون لون')::text as color_name,
    COALESCE(s.name, 'بدون قياس')::text as size_value,
    COALESCE(inv.quantity, 0)::integer as current_quantity,
    COALESCE(inv.reserved_quantity, 0)::integer as current_reserved,
    COALESCE(inv.sold_quantity, 0)::integer as current_sold,
    COALESCE(cr.reserved_qty, 0)::integer as calculated_reserved,
    COALESCE(cs.sold_qty, 0)::integer as calculated_sold,
    (COALESCE(inv.reserved_quantity, 0) - COALESCE(cr.reserved_qty, 0))::integer as reserved_difference,
    (COALESCE(inv.sold_quantity, 0) - COALESCE(cs.sold_qty, 0))::integer as sold_difference,
    CASE
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(cr.reserved_qty, 0) 
           AND COALESCE(inv.sold_quantity, 0) != COALESCE(cs.sold_qty, 0) THEN 'both'
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(cr.reserved_qty, 0) THEN 'reserved'
      WHEN COALESCE(inv.sold_quantity, 0) != COALESCE(cs.sold_qty, 0) THEN 'sold'
      ELSE 'ok'
    END::text as issue_type
  FROM inventory inv
  JOIN products p ON inv.product_id = p.id
  LEFT JOIN product_variants pv ON inv.variant_id = pv.id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN calculated_reserved cr ON inv.variant_id = cr.var_id
  LEFT JOIN calculated_sold cs ON inv.variant_id = cs.var_id
  ORDER BY p.name, c.name, s.name;
END;
$$;

-- إنشاء دالة fix_inventory_discrepancies الجديدة
CREATE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE(
  fixed_variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer,
  fix_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_old_reserved integer;
  v_old_sold integer;
BEGIN
  FOR r IN 
    SELECT * FROM audit_inventory_accuracy() WHERE issue_type != 'ok'
  LOOP
    SELECT reserved_quantity, sold_quantity 
    INTO v_old_reserved, v_old_sold
    FROM inventory WHERE variant_id = r.variant_id;
    
    UPDATE inventory
    SET 
      reserved_quantity = r.calculated_reserved,
      sold_quantity = r.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = r.variant_id;
    
    INSERT INTO inventory_operations_log (
      product_id, variant_id, operation_type, quantity_change,
      quantity_before, quantity_after, notes, source_type, created_by
    ) VALUES (
      r.product_id, r.variant_id, 'audit_correction', 0,
      v_old_reserved, r.calculated_reserved,
      format('تصحيح: محجوز %s→%s، مباع %s→%s', v_old_reserved, r.calculated_reserved, v_old_sold, r.calculated_sold),
      'audit', 'system'
    );
    
    fixed_variant_id := r.variant_id;
    product_name := r.product_name;
    color_name := r.color_name;
    size_value := r.size_value;
    old_reserved := v_old_reserved;
    new_reserved := r.calculated_reserved;
    old_sold := v_old_sold;
    new_sold := r.calculated_sold;
    fix_type := r.issue_type;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- تعطيل تريغر الإشعار المكرر على orders
ALTER TABLE orders DISABLE TRIGGER notify_new_order_trigger;

-- تعطيل تريغر الحذف المتداخل
ALTER TABLE orders DISABLE TRIGGER auto_release_stock_on_delete;