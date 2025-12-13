
-- إصلاح دالة get_products_sold_stats لاستثناء عناصر مُرجعة للمخزون
CREATE OR REPLACE FUNCTION public.get_products_sold_stats()
 RETURNS TABLE(variant_id uuid, total_quantity_sold bigint, total_revenue numeric, orders_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    oi.variant_id,
    SUM(oi.quantity)::bigint as total_quantity_sold,
    SUM(oi.total_price)::numeric as total_revenue,
    COUNT(DISTINCT oi.order_id)::bigint as orders_count
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE (
    -- الطلبات المكتملة أو المسلمة بالكامل
    o.status IN ('completed', 'delivered')
    OR o.delivery_status = '4'
    OR
    -- التسليم الجزئي مع item_status = delivered
    (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
  )
  AND o.status NOT IN ('returned_in_stock')
  -- ✅ إضافة: استثناء عناصر مُرجعة للمخزون من الحساب
  AND (oi.item_status IS NULL OR oi.item_status NOT IN ('returned_in_stock', 'returned'))
  AND oi.variant_id IS NOT NULL
  GROUP BY oi.variant_id;
END;
$function$;

-- إصلاح sold_quantity للمنتجات المتأثرة بناء على البيانات الصحيحة
WITH correct_sold AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as correct_quantity
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE (
    o.status IN ('completed', 'delivered')
    OR o.delivery_status = '4'
    OR (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
  )
  AND o.status NOT IN ('returned_in_stock')
  AND (oi.item_status IS NULL OR oi.item_status NOT IN ('returned_in_stock', 'returned'))
  AND oi.variant_id IS NOT NULL
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET sold_quantity = COALESCE(cs.correct_quantity, 0)
FROM correct_sold cs
WHERE i.variant_id = cs.variant_id
AND i.sold_quantity != cs.correct_quantity;
