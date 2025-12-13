
-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();

-- Recreate with current_available field
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
  current_available integer,
  calculated_reserved integer,
  calculated_sold integer,
  calculated_available integer,
  reserved_diff integer,
  sold_diff integer,
  has_negative boolean,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH reserved_calc AS (
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(oi.quantity), 0)::integer as calc_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND o.status NOT IN ('archived', 'deleted')
      AND NOT (o.order_type = 'return' AND o.direction = 'incoming')
      AND NOT (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    GROUP BY oi.variant_id
  ),
  sold_calc AS (
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(oi.quantity), 0)::integer as calc_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (
      (o.delivery_status = '4' AND o.order_type != 'return')
      OR (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    )
    AND oi.item_direction != 'incoming'
    GROUP BY oi.variant_id
  )
  SELECT 
    pv.id as variant_id,
    p.id as product_id,
    p.name as product_name,
    c.name as color_name,
    s.value as size_value,
    COALESCE(i.quantity, 0)::integer as current_quantity,
    COALESCE(i.reserved_quantity, 0)::integer as current_reserved,
    COALESCE(i.sold_quantity, 0)::integer as current_sold,
    (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))::integer as current_available,
    COALESCE(rc.calc_reserved, 0)::integer as calculated_reserved,
    COALESCE(sc.calc_sold, 0)::integer as calculated_sold,
    (COALESCE(i.quantity, 0) - COALESCE(rc.calc_reserved, 0))::integer as calculated_available,
    (COALESCE(i.reserved_quantity, 0) - COALESCE(rc.calc_reserved, 0))::integer as reserved_diff,
    (COALESCE(i.sold_quantity, 0) - COALESCE(sc.calc_sold, 0))::integer as sold_diff,
    (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) < 0) as has_negative,
    CASE 
      WHEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) < 0 THEN 'negative'
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rc.calc_reserved, 0) 
           AND COALESCE(i.sold_quantity, 0) != COALESCE(sc.calc_sold, 0) THEN 'complex'
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rc.calc_reserved, 0) THEN 'reserved'
      WHEN COALESCE(i.sold_quantity, 0) != COALESCE(sc.calc_sold, 0) THEN 'sold'
      ELSE 'ok'
    END as issue_type
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  LEFT JOIN inventory i ON i.variant_id = pv.id
  LEFT JOIN reserved_calc rc ON rc.v_id = pv.id
  LEFT JOIN sold_calc sc ON sc.v_id = pv.id
  ORDER BY p.name, c.name, s.value;
END;
$$;
