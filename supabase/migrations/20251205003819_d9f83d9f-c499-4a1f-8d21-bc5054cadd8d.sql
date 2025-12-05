-- إصلاح audit_inventory_accuracy لاستخدام get_products_sold_stats مباشرة
DROP FUNCTION IF EXISTS audit_inventory_accuracy();

CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE (
  variant_id uuid,
  product_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_quantity integer,
  current_reserved integer,
  calculated_reserved integer,
  reserved_diff integer,
  current_sold integer,
  calculated_sold integer,
  sold_diff integer,
  current_available integer,
  calculated_available integer,
  issue_type text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- حساب المحجوز الصحيح
  calculated_reserved AS (
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(
        CASE 
          WHEN o.isarchived = true THEN 0
          WHEN o.delivery_status IN ('4', '17') THEN 0
          WHEN oi.item_status = 'delivered' OR oi.item_status = 'returned_in_stock' THEN 0
          WHEN o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'incoming' THEN 0
          ELSE oi.quantity
        END
      ), 0)::integer as reserved_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_type != 'return' OR (o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing')
    GROUP BY oi.variant_id
  ),
  
  -- استخدام get_products_sold_stats مباشرة للمباع (المصدر الصحيح الوحيد)
  calculated_sold AS (
    SELECT variant_id as v_id, total_quantity_sold as sold_qty
    FROM get_products_sold_stats()
  ),
  
  inventory_audit AS (
    SELECT 
      i.variant_id,
      i.product_id,
      i.quantity as current_qty,
      COALESCE(i.reserved_quantity, 0) as current_res,
      COALESCE(cr.reserved_qty, 0) as calc_res,
      COALESCE(i.sold_quantity, 0) as current_sld,
      COALESCE(cs.sold_qty, 0) as calc_sld
    FROM inventory i
    LEFT JOIN calculated_reserved cr ON cr.v_id = i.variant_id
    LEFT JOIN calculated_sold cs ON cs.v_id = i.variant_id
  )
  
  SELECT 
    ia.variant_id,
    ia.product_id,
    p.name::text as product_name,
    COALESCE(c.name, 'افتراضي')::text as color_name,
    COALESCE(s.name, 'افتراضي')::text as size_value,
    ia.current_qty as current_quantity,
    ia.current_res as current_reserved,
    ia.calc_res as calculated_reserved,
    (ia.current_res - ia.calc_res) as reserved_diff,
    ia.current_sld as current_sold,
    ia.calc_sld as calculated_sold,
    (ia.current_sld - ia.calc_sld) as sold_diff,
    (ia.current_qty - ia.current_res) as current_available,
    (ia.current_qty - ia.calc_res) as calculated_available,
    CASE 
      WHEN ia.current_res < 0 THEN 'negative_reserved'
      WHEN ia.current_sld < 0 THEN 'negative_sold'
      WHEN (ia.current_qty - ia.current_res) < 0 THEN 'negative_available'
      WHEN ia.current_res != ia.calc_res AND ia.current_sld != ia.calc_sld THEN 'reserved_and_sold'
      WHEN ia.current_res != ia.calc_res THEN 'reserved_only'
      WHEN ia.current_sld != ia.calc_sld THEN 'sold_only'
      WHEN ia.current_qty < (ia.current_res + ia.current_sld) THEN 'consistency_error'
      ELSE NULL
    END as issue_type
  FROM inventory_audit ia
  JOIN products p ON p.id = ia.product_id
  LEFT JOIN product_variants pv ON pv.id = ia.variant_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  WHERE 
    ia.current_res != ia.calc_res 
    OR ia.current_sld != ia.calc_sld
    OR ia.current_res < 0
    OR ia.current_sld < 0
    OR (ia.current_qty - ia.current_res) < 0
  ORDER BY p.name, c.name, s.name;
END;
$$;

COMMENT ON FUNCTION audit_inventory_accuracy() IS 'فحص شامل لدقة المخزون - يستخدم get_products_sold_stats مباشرة للمبيعات';