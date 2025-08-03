-- حذف الـ views وإنشاء functions بدلاً منها
DROP VIEW IF EXISTS public.products_sold_stats;
DROP VIEW IF EXISTS public.sales_summary_stats;

-- إنشاء function للحصول على إحصائيات المنتجات المباعة
CREATE OR REPLACE FUNCTION public.get_products_sold_stats()
RETURNS TABLE (
  variant_id UUID,
  product_id UUID, 
  sold_quantity BIGINT,
  orders_count BIGINT,
  total_revenue NUMERIC,
  total_cost NUMERIC,
  last_sold_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id as variant_id,
    pv.product_id,
    COALESCE(SUM(oi.quantity), 0)::BIGINT as sold_quantity,
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
END;
$$;

-- إنشاء function للحصول على ملخص إحصائيات المبيعات
CREATE OR REPLACE FUNCTION public.get_sales_summary_stats()
RETURNS TABLE (
  total_orders BIGINT,
  total_products_sold BIGINT,
  total_revenue NUMERIC,
  total_cogs NUMERIC,
  total_delivery_fees NUMERIC
)
LANGUAGE plpgsql  
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(oi.quantity), 0)::BIGINT as total_products_sold,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    COALESCE(SUM(oi.quantity * pv.cost_price), 0) as total_cogs,
    COALESCE(SUM(o.delivery_fee), 0) as total_delivery_fees
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  WHERE o.status IN ('completed', 'delivered')
  AND o.receipt_received = true;
END;
$$;