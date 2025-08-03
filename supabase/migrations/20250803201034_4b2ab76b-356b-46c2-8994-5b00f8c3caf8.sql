-- إنشاء دالة موحدة لجلب إحصائيات المخزون
CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats()
RETURNS TABLE(
  total_products BIGINT,
  total_variants BIGINT,
  high_stock_count BIGINT,
  medium_stock_count BIGINT,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  reserved_stock_count BIGINT,
  archived_products_count BIGINT,
  total_inventory_value NUMERIC,
  departments_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH inventory_stats AS (
    SELECT 
      COUNT(DISTINCT p.id) as total_products,
      COUNT(pv.id) as total_variants,
      COUNT(CASE WHEN i.quantity > 20 THEN 1 END) as high_stock_count,
      COUNT(CASE WHEN i.quantity BETWEEN 10 AND 20 THEN 1 END) as medium_stock_count,
      COUNT(CASE WHEN i.quantity BETWEEN 1 AND 9 THEN 1 END) as low_stock_count,
      COUNT(CASE WHEN COALESCE(i.quantity, 0) = 0 THEN 1 END) as out_of_stock_count,
      COUNT(CASE WHEN COALESCE(i.reserved_quantity, 0) > 0 THEN 1 END) as reserved_stock_count,
      COUNT(CASE WHEN p.is_archived = true THEN 1 END) as archived_products_count,
      COALESCE(SUM(COALESCE(i.quantity, 0) * COALESCE(pv.cost_price, 0)), 0) as total_inventory_value
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_archived = false
  ),
  departments_stats AS (
    SELECT 
      d.id,
      d.name,
      d.color,
      d.icon,
      COUNT(DISTINCT p.id) as product_count,
      COALESCE(SUM(COALESCE(i.quantity, 0)), 0) as total_stock
    FROM departments d
    LEFT JOIN product_departments pd ON d.id = pd.department_id
    LEFT JOIN products p ON pd.product_id = p.id AND p.is_archived = false
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    GROUP BY d.id, d.name, d.color, d.icon
    ORDER BY product_count DESC
  )
  SELECT 
    is.total_products::BIGINT,
    is.total_variants::BIGINT,
    is.high_stock_count::BIGINT,
    is.medium_stock_count::BIGINT,
    is.low_stock_count::BIGINT,
    is.out_of_stock_count::BIGINT,
    is.reserved_stock_count::BIGINT,
    is.archived_products_count::BIGINT,
    is.total_inventory_value,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', ds.id,
          'name', ds.name,
          'color', ds.color,
          'icon', ds.icon,
          'product_count', ds.product_count,
          'total_stock', ds.total_stock
        )
      ) FROM departments_stats ds),
      '[]'::jsonb
    ) as departments_data
  FROM inventory_stats is;
END;
$function$

-- إنشاء دالة موحدة لإحصائيات الطلبات (تشمل أفضل العملاء والمحافظات والمنتجات)
CREATE OR REPLACE FUNCTION public.get_unified_orders_analytics()
RETURNS TABLE(
  total_orders BIGINT,
  pending_orders BIGINT,
  completed_orders BIGINT,
  total_revenue NUMERIC,
  top_customers JSONB,
  top_products JSONB,
  top_provinces JSONB,
  pending_profits JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH orders_stats AS (
    SELECT 
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status IN ('completed', 'delivered') THEN 1 END) as completed_orders,
      COALESCE(SUM(CASE WHEN status IN ('completed', 'delivered') THEN final_amount ELSE 0 END), 0) as total_revenue
    FROM orders
    WHERE status NOT IN ('returned', 'cancelled')
    AND NOT isArchived = true
  ),
  top_customers_data AS (
    SELECT 
      customer_phone,
      customer_name,
      COUNT(*) as total_orders,
      SUM(final_amount) as total_amount
    FROM orders
    WHERE status IN ('completed', 'delivered')
    AND status NOT IN ('returned', 'cancelled')
    AND NOT isArchived = true
    AND customer_phone IS NOT NULL
    GROUP BY customer_phone, customer_name
    ORDER BY total_orders DESC, total_amount DESC
    LIMIT 10
  ),
  top_products_data AS (
    SELECT 
      p.name as product_name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.total_price) as total_amount
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.status IN ('completed', 'delivered')
    AND o.status NOT IN ('returned', 'cancelled')
    AND NOT o.isArchived = true
    GROUP BY p.id, p.name
    ORDER BY total_quantity DESC
    LIMIT 10
  ),
  top_provinces_data AS (
    SELECT 
      COALESCE(customer_city, customer_province, 'غير محدد') as province_name,
      COUNT(*) as total_orders,
      SUM(final_amount) as total_amount
    FROM orders
    WHERE status IN ('completed', 'delivered')
    AND status NOT IN ('returned', 'cancelled')
    AND NOT isArchived = true
    GROUP BY COALESCE(customer_city, customer_province, 'غير محدد')
    ORDER BY total_orders DESC, total_amount DESC
    LIMIT 10
  ),
  pending_profits_data AS (
    SELECT 
      COUNT(*) as orders_count,
      COUNT(DISTINCT employee_id) as employees_count,
      COALESCE(SUM(profit_amount), 0) as total_pending_amount,
      COALESCE(SUM(employee_profit), 0) as total_employee_profits
    FROM profits
    WHERE status = 'pending'
  )
  SELECT 
    os.total_orders,
    os.pending_orders,
    os.completed_orders,
    os.total_revenue,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'phone', tc.customer_phone,
          'name', tc.customer_name,
          'totalOrders', tc.total_orders,
          'totalAmount', tc.total_amount
        )
      ) FROM top_customers_data tc),
      '[]'::jsonb
    ) as top_customers,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', tp.product_name,
          'totalQuantity', tp.total_quantity,
          'totalAmount', tp.total_amount
        )
      ) FROM top_products_data tp),
      '[]'::jsonb
    ) as top_products,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'name', tpr.province_name,
          'totalOrders', tpr.total_orders,
          'totalAmount', tpr.total_amount
        )
      ) FROM top_provinces_data tpr),
      '[]'::jsonb
    ) as top_provinces,
    (SELECT jsonb_build_object(
      'orders_count', ppd.orders_count,
      'employees_count', ppd.employees_count,
      'total_pending_amount', ppd.total_pending_amount,
      'total_employee_profits', ppd.total_employee_profits
    ) FROM pending_profits_data ppd) as pending_profits
  FROM orders_stats os;
END;
$function$