
-- إصلاح دالة audit_inventory_accuracy لتُرجع variant_id بدلاً من product_id
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();

CREATE OR REPLACE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
  variant_id uuid,
  product_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_quantity integer,
  current_reserved integer,
  current_sold integer,
  calculated_reserved integer,
  calculated_sold integer,
  calculated_available integer,
  current_available integer,
  reserved_diff integer,
  sold_diff integer,
  has_negative boolean,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH reserved_calc AS (
    SELECT 
      oi.product_id as p_id,
      oi.color,
      oi.size,
      COALESCE(SUM(oi.quantity), 0)::integer as calc_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND o.isarchived = false
      AND NOT (o.order_type = 'return' AND o.direction = 'incoming')
      AND NOT (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    GROUP BY oi.product_id, oi.color, oi.size
  ),
  sold_calc AS (
    SELECT 
      oi.product_id as p_id,
      oi.color,
      oi.size,
      COALESCE(SUM(oi.quantity), 0)::integer as calc_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (
      (o.delivery_status = '4' AND o.order_type != 'return')
      OR (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    )
      AND NOT (o.order_type = 'return' AND o.direction = 'incoming')
      AND oi.item_direction != 'incoming'
    GROUP BY oi.product_id, oi.color, oi.size
  )
  SELECT 
    i.id as variant_id,
    i.product_id,
    p.name as product_name,
    i.color_name,
    i.size_value,
    i.quantity as current_quantity,
    i.reserved_quantity as current_reserved,
    i.sold_quantity as current_sold,
    COALESCE(rc.calc_reserved, 0)::integer as calculated_reserved,
    COALESCE(sc.calc_sold, 0)::integer as calculated_sold,
    (i.quantity - COALESCE(rc.calc_reserved, 0))::integer as calculated_available,
    (i.quantity - i.reserved_quantity)::integer as current_available,
    (i.reserved_quantity - COALESCE(rc.calc_reserved, 0))::integer as reserved_diff,
    (i.sold_quantity - COALESCE(sc.calc_sold, 0))::integer as sold_diff,
    (i.quantity < 0 OR i.reserved_quantity < 0 OR i.sold_quantity < 0) as has_negative,
    CASE
      WHEN i.quantity < 0 OR i.reserved_quantity < 0 OR i.sold_quantity < 0 THEN 'negative_values'
      WHEN i.reserved_quantity != COALESCE(rc.calc_reserved, 0) AND i.sold_quantity != COALESCE(sc.calc_sold, 0) THEN 'both_mismatch'
      WHEN i.reserved_quantity != COALESCE(rc.calc_reserved, 0) THEN 'reserved_mismatch'
      WHEN i.sold_quantity != COALESCE(sc.calc_sold, 0) THEN 'sold_mismatch'
      ELSE 'ok'
    END as issue_type
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  WHERE i.quantity > 0 OR i.reserved_quantity > 0 OR i.sold_quantity > 0
  ORDER BY 
    CASE 
      WHEN i.quantity < 0 OR i.reserved_quantity < 0 OR i.sold_quantity < 0 THEN 1
      WHEN i.reserved_quantity != COALESCE(rc.calc_reserved, 0) AND i.sold_quantity != COALESCE(sc.calc_sold, 0) THEN 2
      WHEN i.reserved_quantity != COALESCE(rc.calc_reserved, 0) THEN 3
      WHEN i.sold_quantity != COALESCE(sc.calc_sold, 0) THEN 4
      ELSE 5
    END,
    p.name;
END;
$$;

-- إصلاح دالة fix_inventory_discrepancies لتستخدم variant_id
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies();

CREATE OR REPLACE FUNCTION public.fix_inventory_discrepancies()
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
  r record;
BEGIN
  FOR r IN 
    SELECT * FROM audit_inventory_accuracy() 
    WHERE issue_type != 'ok'
  LOOP
    -- تحديث المخزون باستخدام variant_id
    UPDATE inventory
    SET 
      reserved_quantity = r.calculated_reserved,
      sold_quantity = r.calculated_sold,
      updated_at = NOW()
    WHERE id = r.variant_id;
    
    -- تسجيل في السجل
    INSERT INTO inventory_operations_log (
      inventory_id,
      operation_type,
      source_type,
      quantity_change,
      reserved_change,
      sold_change,
      notes,
      created_by
    ) VALUES (
      r.variant_id,
      'audit_correction',
      'audit',
      0,
      r.calculated_reserved - r.current_reserved,
      r.calculated_sold - r.current_sold,
      format('تصحيح تلقائي: محجوز %s→%s، مباع %s→%s', 
        r.current_reserved, r.calculated_reserved,
        r.current_sold, r.calculated_sold),
      auth.uid()
    );
    
    v_fixed_count := v_fixed_count + 1;
    v_details := v_details || jsonb_build_object(
      'variant_id', r.variant_id,
      'product_name', r.product_name,
      'color', r.color_name,
      'size', r.size_value,
      'issue_type', r.issue_type,
      'reserved_before', r.current_reserved,
      'reserved_after', r.calculated_reserved,
      'sold_before', r.current_sold,
      'sold_after', r.calculated_sold
    );
  END LOOP;
  
  RETURN QUERY SELECT v_fixed_count, v_details;
END;
$$;
