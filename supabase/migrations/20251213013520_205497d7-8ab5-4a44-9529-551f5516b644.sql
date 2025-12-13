-- Drop existing functions first
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies();

-- Fix audit_inventory_accuracy to exclude partial_delivery from delivered_stats (prevents double-counting)
CREATE OR REPLACE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_quantity integer,
  current_reserved integer,
  current_sold integer,
  calculated_reserved integer,
  calculated_sold integer,
  calculated_available integer,
  quantity_diff integer,
  reserved_diff integer,
  sold_diff integer,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH reserved_stats AS (
    SELECT 
      oi.variant_id,
      COALESCE(SUM(oi.quantity), 0)::integer as total_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND COALESCE(o.isarchived, false) = false
      AND NOT (COALESCE(o.order_type, '') = 'return' AND COALESCE(o.direction, '') = 'incoming')
      AND COALESCE(o.order_type, '') != 'partial_delivery'
    GROUP BY oi.variant_id
  ),
  delivered_stats AS (
    SELECT 
      oi.variant_id,
      COALESCE(SUM(oi.quantity), 0)::integer as total_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (o.delivery_status = '4' OR o.status IN ('completed', 'delivered'))
      AND COALESCE(o.order_type, '') != 'return'
      AND COALESCE(o.order_type, '') != 'partial_delivery'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  ),
  partial_delivery_sold AS (
    SELECT 
      oi.variant_id,
      COALESCE(SUM(oi.quantity), 0)::integer as total_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_type = 'partial_delivery'
      AND oi.item_status = 'delivered'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  )
  SELECT 
    i.variant_id,
    p.name as product_name,
    c.name as color_name,
    pv.size as size_value,
    COALESCE(i.quantity, 0)::integer as current_quantity,
    COALESCE(i.reserved_quantity, 0)::integer as current_reserved,
    COALESCE(i.sold_quantity, 0)::integer as current_sold,
    COALESCE(rs.total_reserved, 0)::integer as calculated_reserved,
    (COALESCE(ds.total_sold, 0) + COALESCE(pds.total_sold, 0))::integer as calculated_sold,
    (COALESCE(i.quantity, 0) - COALESCE(rs.total_reserved, 0))::integer as calculated_available,
    0::integer as quantity_diff,
    (COALESCE(i.reserved_quantity, 0) - COALESCE(rs.total_reserved, 0))::integer as reserved_diff,
    (COALESCE(i.sold_quantity, 0) - (COALESCE(ds.total_sold, 0) + COALESCE(pds.total_sold, 0)))::integer as sold_diff,
    CASE 
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rs.total_reserved, 0) 
           AND COALESCE(i.sold_quantity, 0) != (COALESCE(ds.total_sold, 0) + COALESCE(pds.total_sold, 0)) 
        THEN 'reserved_and_sold_mismatch'
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rs.total_reserved, 0) 
        THEN 'reserved_mismatch'
      WHEN COALESCE(i.sold_quantity, 0) != (COALESCE(ds.total_sold, 0) + COALESCE(pds.total_sold, 0)) 
        THEN 'sold_mismatch'
      WHEN COALESCE(i.quantity, 0) < COALESCE(i.reserved_quantity, 0) 
        THEN 'negative_available'
      ELSE 'ok'
    END as issue_type
  FROM inventory i
  JOIN product_variants pv ON pv.id = i.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN reserved_stats rs ON rs.variant_id = i.variant_id
  LEFT JOIN delivered_stats ds ON ds.variant_id = i.variant_id
  LEFT JOIN partial_delivery_sold pds ON pds.variant_id = i.variant_id
  ORDER BY 
    CASE 
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rs.total_reserved, 0) 
           OR COALESCE(i.sold_quantity, 0) != (COALESCE(ds.total_sold, 0) + COALESCE(pds.total_sold, 0))
        THEN 0 
      ELSE 1 
    END,
    p.name, c.name, pv.size;
END;
$$;

-- Also update fix_inventory_discrepancies to use same logic
CREATE OR REPLACE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer,
  fixed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH discrepancies AS (
    SELECT * FROM audit_inventory_accuracy() WHERE issue_type != 'ok'
  )
  UPDATE inventory inv
  SET 
    reserved_quantity = d.calculated_reserved,
    sold_quantity = d.calculated_sold
  FROM discrepancies d
  WHERE inv.variant_id = d.variant_id
  RETURNING 
    inv.variant_id,
    d.product_name,
    d.current_reserved as old_reserved,
    d.calculated_reserved as new_reserved,
    d.current_sold as old_sold,
    d.calculated_sold as new_sold,
    true as fixed;
END;
$$;