-- إصلاح دالة audit_inventory_accuracy - استخدام sz.name بدلاً من sz.value
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
    COALESCE(sz.name, 'بدون مقاس') as size_value,
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
  ORDER BY p.name, cl.name, sz.name;
END;
$$;