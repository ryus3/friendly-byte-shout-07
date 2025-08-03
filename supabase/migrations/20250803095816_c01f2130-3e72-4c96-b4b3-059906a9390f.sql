-- إنشاء view للمنتجات المباعة (محسوبة مرة واحدة)
CREATE OR REPLACE VIEW public.products_sold_stats AS
SELECT 
  pv.id as variant_id,
  pv.product_id,
  COALESCE(SUM(oi.quantity), 0) as sold_quantity,
  COUNT(DISTINCT o.id) as orders_count,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue,
  COALESCE(SUM(oi.quantity * pv.cost_price), 0) as total_cost,
  MAX(o.created_at) as last_sold_date
FROM product_variants pv
LEFT JOIN order_items oi ON pv.id = oi.variant_id
LEFT JOIN orders o ON oi.order_id = o.id 
  AND o.status IN ('completed', 'delivered')
  AND o.receipt_received = true
GROUP BY pv.id, pv.product_id;

-- إنشاء view للإحصائيات العامة للمبيعات
CREATE OR REPLACE VIEW public.sales_summary_stats AS
SELECT 
  COUNT(DISTINCT o.id) as total_orders,
  COALESCE(SUM(oi.quantity), 0) as total_products_sold,
  COALESCE(SUM(o.total_amount), 0) as total_revenue,
  COALESCE(SUM(oi.quantity * pv.cost_price), 0) as total_cogs,
  COALESCE(SUM(o.delivery_fee), 0) as total_delivery_fees
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN product_variants pv ON oi.variant_id = pv.id
WHERE o.status IN ('completed', 'delivered')
AND o.receipt_received = true;

-- تعليق: هذه الـ views تحسب البيانات مرة واحدة وتكون متاحة لكل النظام