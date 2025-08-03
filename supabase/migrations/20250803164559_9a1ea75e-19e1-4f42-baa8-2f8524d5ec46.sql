-- إنشاء دالة موحدة لإحصائيات الطلبات والعملاء
CREATE OR REPLACE FUNCTION public.get_unified_orders_analytics()
RETURNS TABLE(
  -- إحصائيات عامة للطلبات
  total_orders bigint,
  pending_orders bigint,
  completed_orders bigint,
  total_revenue numeric,
  
  -- أفضل العملاء (أول 10)
  top_customers jsonb,
  
  -- أفضل المنتجات (أول 10) 
  top_products jsonb,
  
  -- أفضل المحافظات (أول 10)
  top_provinces jsonb,
  
  -- إحصائيات الأرباح المعلقة
  pending_profits jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- إحصائيات عامة للطلبات
  SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE status = 'completed' AND receipt_received = true) as completed_orders,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed' AND receipt_received = true), 0) as total_revenue
  INTO result_record
  FROM orders;
  
  RETURN QUERY
  SELECT 
    -- إحصائيات عامة
    result_record.total_orders,
    result_record.pending_orders, 
    result_record.completed_orders,
    result_record.total_revenue,
    
    -- أفضل العملاء (أول 10)
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'phone', c.phone,
          'total_orders', customer_stats.order_count,
          'total_spent', customer_stats.total_spent,
          'city', c.city,
          'province', c.province
        )
      )
      FROM (
        SELECT 
          customer_id,
          COUNT(*) as order_count,
          SUM(total_amount) as total_spent
        FROM orders 
        WHERE status = 'completed' AND receipt_received = true
        AND customer_id IS NOT NULL
        GROUP BY customer_id
        ORDER BY total_spent DESC
        LIMIT 10
      ) customer_stats
      JOIN customers c ON c.id = customer_stats.customer_id
    ) as top_customers,
    
    -- أفضل المنتجات (أول 10)
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'product_name', p.name,
          'total_sold', product_stats.total_quantity,
          'total_revenue', product_stats.total_revenue,
          'orders_count', product_stats.orders_count
        )
      )
      FROM (
        SELECT 
          oi.product_id,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.total_price) as total_revenue,
          COUNT(DISTINCT o.id) as orders_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'completed' AND o.receipt_received = true
        GROUP BY oi.product_id
        ORDER BY total_revenue DESC
        LIMIT 10
      ) product_stats
      JOIN products p ON p.id = product_stats.product_id
    ) as top_products,
    
    -- أفضل المحافظات (أول 10)
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'province', province_stats.province,
          'total_orders', province_stats.order_count,
          'total_revenue', province_stats.total_revenue,
          'avg_order_value', province_stats.avg_order_value
        )
      )
      FROM (
        SELECT 
          province,
          COUNT(*) as order_count,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value
        FROM orders 
        WHERE status = 'completed' AND receipt_received = true
        AND province IS NOT NULL AND province != ''
        GROUP BY province
        ORDER BY total_revenue DESC
        LIMIT 10
      ) province_stats
    ) as top_provinces,
    
    -- إحصائيات الأرباح المعلقة
    (
      SELECT jsonb_build_object(
        'total_pending_amount', COALESCE(SUM(profit_amount), 0),
        'total_employee_profits', COALESCE(SUM(employee_profit), 0),
        'employees_count', COUNT(DISTINCT employee_id),
        'orders_count', COUNT(*)
      )
      FROM profits 
      WHERE status = 'pending'
    ) as pending_profits;
END;
$$;