-- إصلاح شامل: دالة audit_inventory_accuracy باستخدام variant_id الصحيح
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();

CREATE OR REPLACE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
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
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH reserved_calc AS (
    -- حساب المحجوز: الطلبات النشطة (ليست delivered=4 أو returned=17)
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as calc_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND COALESCE(o.isarchived, false) = false
      AND NOT (o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'incoming')
      AND o.order_type != 'partial_delivery'
    GROUP BY oi.variant_id
  ),
  sold_calc AS (
    -- المباع: الطلبات المسلمة (delivery_status=4)
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as calc_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (o.delivery_status = '4' OR o.status IN ('completed', 'delivered'))
      AND o.order_type != 'return'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
    
    UNION ALL
    
    -- التسليم الجزئي: العناصر المسلمة فقط
    SELECT 
      oi.variant_id,
      SUM(oi.quantity)::integer as calc_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_type = 'partial_delivery'
      AND oi.item_status = 'delivered'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  ),
  sold_totals AS (
    SELECT variant_id, SUM(calc_sold)::integer as calc_sold
    FROM sold_calc
    GROUP BY variant_id
  )
  SELECT 
    i.product_id,
    p.name::text as product_name,
    COALESCE(c.name, '')::text as color_name,
    COALESCE(s.name, '')::text as size_value,
    COALESCE(i.quantity, 0)::integer as current_quantity,
    COALESCE(i.reserved_quantity, 0)::integer as current_reserved,
    COALESCE(i.sold_quantity, 0)::integer as current_sold,
    (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))::integer as current_available,
    COALESCE(rc.calc_reserved, 0)::integer as calculated_reserved,
    COALESCE(st.calc_sold, 0)::integer as calculated_sold,
    CASE 
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rc.calc_reserved, 0) 
           AND COALESCE(i.sold_quantity, 0) != COALESCE(st.calc_sold, 0) THEN 'reserved_and_sold_mismatch'
      WHEN COALESCE(i.reserved_quantity, 0) != COALESCE(rc.calc_reserved, 0) THEN 'reserved_mismatch'
      WHEN COALESCE(i.sold_quantity, 0) != COALESCE(st.calc_sold, 0) THEN 'sold_mismatch'
      ELSE 'ok'
    END::text as issue_type
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  LEFT JOIN product_variants pv ON pv.id = i.variant_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  LEFT JOIN reserved_calc rc ON rc.variant_id = i.variant_id
  LEFT JOIN sold_totals st ON st.variant_id = i.variant_id
  WHERE COALESCE(i.reserved_quantity, 0) != COALESCE(rc.calc_reserved, 0)
     OR COALESCE(i.sold_quantity, 0) != COALESCE(st.calc_sold, 0);
END;
$$;

-- إصلاح الفروقات في المخزون مباشرة باستخدام variant_id
WITH reserved_calc AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity)::integer as calc_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.delivery_status NOT IN ('4', '17')
    AND COALESCE(o.isarchived, false) = false
    AND NOT (o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'incoming')
    AND o.order_type != 'partial_delivery'
  GROUP BY oi.variant_id
),
sold_calc AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity)::integer as calc_sold
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE (o.delivery_status = '4' OR o.status IN ('completed', 'delivered'))
    AND o.order_type != 'return'
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
  GROUP BY oi.variant_id
  
  UNION ALL
  
  SELECT 
    oi.variant_id,
    SUM(oi.quantity)::integer as calc_sold
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.order_type = 'partial_delivery'
    AND oi.item_status = 'delivered'
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
  GROUP BY oi.variant_id
),
sold_totals AS (
  SELECT variant_id, SUM(calc_sold)::integer as calc_sold
  FROM sold_calc
  GROUP BY variant_id
)
UPDATE inventory i
SET 
  reserved_quantity = COALESCE(rc.calc_reserved, 0),
  sold_quantity = COALESCE(st.calc_sold, 0)
FROM inventory inv
LEFT JOIN reserved_calc rc ON rc.variant_id = inv.variant_id
LEFT JOIN sold_totals st ON st.variant_id = inv.variant_id
WHERE i.id = inv.id
  AND (COALESCE(i.reserved_quantity, 0) != COALESCE(rc.calc_reserved, 0)
       OR COALESCE(i.sold_quantity, 0) != COALESCE(st.calc_sold, 0));