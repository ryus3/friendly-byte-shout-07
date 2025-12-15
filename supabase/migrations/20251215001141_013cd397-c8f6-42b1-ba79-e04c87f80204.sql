-- حذف الدالة القديمة أولاً ثم إعادة إنشائها مع current_available
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();

CREATE OR REPLACE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  color_name text,
  size_name text,
  current_quantity integer,
  current_reserved integer,
  current_sold integer,
  current_available integer,
  calculated_reserved integer,
  calculated_sold integer,
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
  WITH active_orders_reserved AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as total_reserved
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND o.isarchived = false
      AND o.order_type != 'return'
      AND (o.order_type != 'partial_delivery' OR o.is_partial_delivery = false)
    GROUP BY oi.variant_id
  ),
  delivered_orders_sold AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as total_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE (o.delivery_status = '4' OR o.status IN ('completed', 'delivered'))
      AND o.order_type != 'return'
      AND oi.item_direction != 'incoming'
    GROUP BY oi.variant_id
    
    UNION ALL
    
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as total_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.order_type = 'partial_delivery'
      AND oi.item_status = 'delivered'
      AND oi.item_direction != 'incoming'
    GROUP BY oi.variant_id
  ),
  sold_aggregated AS (
    SELECT variant_id, SUM(total_sold)::integer as total_sold
    FROM delivered_orders_sold
    GROUP BY variant_id
  )
  SELECT 
    inv.variant_id,
    COALESCE(p.name, 'غير معروف')::text as product_name,
    COALESCE(c.name, 'بدون لون')::text as color_name,
    COALESCE(sz.name, 'بدون قياس')::text as size_name,
    COALESCE(inv.quantity, 0)::integer as current_quantity,
    COALESCE(inv.reserved_quantity, 0)::integer as current_reserved,
    COALESCE(inv.sold_quantity, 0)::integer as current_sold,
    (COALESCE(inv.quantity, 0) - COALESCE(inv.reserved_quantity, 0))::integer as current_available,
    COALESCE(aor.total_reserved, 0)::integer as calculated_reserved,
    COALESCE(sa.total_sold, 0)::integer as calculated_sold,
    (COALESCE(inv.reserved_quantity, 0) - COALESCE(aor.total_reserved, 0))::integer as reserved_diff,
    (COALESCE(inv.sold_quantity, 0) - COALESCE(sa.total_sold, 0))::integer as sold_diff,
    CASE
      WHEN inv.reserved_quantity < 0 THEN 'negative_reserved'
      WHEN inv.sold_quantity < 0 THEN 'negative_sold'
      WHEN (inv.quantity - inv.reserved_quantity) < 0 THEN 'negative_available'
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(aor.total_reserved, 0) 
           AND COALESCE(inv.sold_quantity, 0) != COALESCE(sa.total_sold, 0) THEN 'both'
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(aor.total_reserved, 0) THEN 'reserved'
      WHEN COALESCE(inv.sold_quantity, 0) != COALESCE(sa.total_sold, 0) THEN 'sold'
      ELSE 'ok'
    END::text as issue_type
  FROM inventory inv
  JOIN product_variants pv ON inv.variant_id = pv.id
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes sz ON pv.size_id = sz.id
  LEFT JOIN active_orders_reserved aor ON inv.variant_id = aor.variant_id
  LEFT JOIN sold_aggregated sa ON inv.variant_id = sa.variant_id
  WHERE p.is_active = true
  ORDER BY 
    CASE 
      WHEN inv.reserved_quantity < 0 OR inv.sold_quantity < 0 OR (inv.quantity - inv.reserved_quantity) < 0 THEN 1
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(aor.total_reserved, 0) 
           AND COALESCE(inv.sold_quantity, 0) != COALESCE(sa.total_sold, 0) THEN 2
      WHEN COALESCE(inv.reserved_quantity, 0) != COALESCE(aor.total_reserved, 0) THEN 3
      WHEN COALESCE(inv.sold_quantity, 0) != COALESCE(sa.total_sold, 0) THEN 4
      ELSE 5
    END,
    p.name;
END;
$$;