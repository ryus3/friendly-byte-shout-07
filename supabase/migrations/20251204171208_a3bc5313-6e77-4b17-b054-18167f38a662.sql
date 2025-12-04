
-- إصلاح sold_quantity ليشمل التسليمات الجزئية التاريخية
-- هذا يُطابق منطق get_products_sold_stats() الذي يعرض الأرقام الصحيحة في الواجهة

WITH correct_sold AS (
  -- الطلبات المسلمة بالكامل (delivery_status = '4')
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as sold_qty
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE o.delivery_status = '4'
    AND o.order_type IS DISTINCT FROM 'return'
    AND o.isarchived IS NOT TRUE
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  GROUP BY oi.variant_id
  
  UNION ALL
  
  -- التسليمات الجزئية (item_status = 'delivered')
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as sold_qty
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE oi.item_status = 'delivered'
    AND o.delivery_status != '4'  -- تجنب العد المزدوج
    AND o.order_type IS DISTINCT FROM 'return'
    AND o.isarchived IS NOT TRUE
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  GROUP BY oi.variant_id
),
aggregated_sold AS (
  SELECT variant_id, SUM(sold_qty) as total_sold
  FROM correct_sold
  GROUP BY variant_id
)
UPDATE inventory i
SET 
  sold_quantity = COALESCE(a.total_sold, 0),
  updated_at = now()
FROM aggregated_sold a
WHERE i.variant_id = a.variant_id
  AND i.sold_quantity != COALESCE(a.total_sold, 0);
