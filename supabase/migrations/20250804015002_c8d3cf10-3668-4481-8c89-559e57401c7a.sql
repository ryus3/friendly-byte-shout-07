-- إنشاء دالة موحدة لجلب إحصائيات الطلبات والعملاء مع تجميع حسب رقم الهاتف وفلترة حسب المستخدم
CREATE OR REPLACE FUNCTION public.get_unified_orders_analytics_by_user()
RETURNS TABLE(
  total_orders bigint,
  pending_orders bigint, 
  completed_orders bigint,
  total_revenue numeric,
  top_customers jsonb,
  top_products jsonb,
  top_provinces jsonb,
  pending_profits jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  customer_stats jsonb;
  product_stats jsonb;
  province_stats jsonb;
  pending_profit_stats jsonb;
BEGIN
  -- جلب إحصائيات الزبائن مجمعة حسب رقم الهاتف
  WITH customer_phone_groups AS (
    SELECT 
      -- تطبيع رقم الهاتف
      CASE 
        WHEN c.phone IS NULL OR TRIM(c.phone) = '' THEN 'غير محدد'
        ELSE REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(c.phone, '[\s\-\(\)]', '', 'g'),
            '^(\+964|00964)', '', 'g'
          ),
          '^0', '', 'g'
        )
      END as normalized_phone,
      -- أخذ أول اسم وبيانات للمجموعة
      (array_agg(c.name ORDER BY c.created_at))[1] as customer_name,
      (array_agg(c.city ORDER BY c.created_at))[1] as customer_city,
      (array_agg(c.province ORDER BY c.created_at))[1] as customer_province,
      (array_agg(c.phone ORDER BY c.created_at))[1] as original_phone,
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id 
      AND o.status IN ('completed', 'delivered') 
      AND o.receipt_received = true
      AND o.created_by = current_user_id  -- فلترة حسب المستخدم الحالي
    WHERE c.created_by = current_user_id  -- فلترة العملاء حسب المستخدم الحالي
    GROUP BY normalized_phone
    HAVING COUNT(DISTINCT o.id) > 0  -- فقط الزبائن الذين لديهم طلبات
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', customer_name,
      'phone', original_phone,
      'city', customer_city,
      'province', customer_province,
      'total_orders', total_orders,
      'total_spent', total_spent,
      'last_order_date', last_order_date
    ) ORDER BY total_orders DESC, total_spent DESC
  )
  INTO customer_stats
  FROM customer_phone_groups;

  -- جلب إحصائيات المنتجات للمستخدم الحالي
  WITH product_sales AS (
    SELECT 
      p.name as product_name,
      pv.id as variant_id,
      c.name as color_name,
      s.name as size_name,
      COUNT(DISTINCT oi.order_id) as orders_count,
      SUM(oi.quantity) as total_sold,
      SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN product_variants pv ON oi.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    WHERE o.status IN ('completed', 'delivered') 
      AND o.receipt_received = true
      AND o.created_by = current_user_id  -- فلترة حسب المستخدم الحالي
    GROUP BY p.name, pv.id, c.name, s.name
    ORDER BY total_sold DESC, total_revenue DESC
    LIMIT 10
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_name', product_name,
      'variant_id', variant_id,
      'color_name', color_name,
      'size_name', size_name,
      'orders_count', orders_count,
      'total_sold', total_sold,
      'total_revenue', total_revenue
    )
  )
  INTO product_stats
  FROM product_sales;

  -- جلب إحصائيات المحافظات للمستخدم الحالي
  WITH province_sales AS (
    SELECT 
      COALESCE(c.city, 'غير محدد') as city_name,
      COUNT(DISTINCT o.id) as total_orders,
      SUM(o.total_amount) as total_revenue
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.status IN ('completed', 'delivered') 
      AND o.receipt_received = true
      AND o.created_by = current_user_id  -- فلترة حسب المستخدم الحالي
    GROUP BY c.city
    ORDER BY total_orders DESC, total_revenue DESC
    LIMIT 10
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'city_name', city_name,
      'total_orders', total_orders,
      'total_revenue', total_revenue
    )
  )
  INTO province_stats
  FROM province_sales;

  -- جلب إحصائيات الأرباح المعلقة للمستخدم الحالي
  SELECT jsonb_build_object(
    'total_pending_amount', COALESCE(SUM(profit_amount), 0),
    'total_employee_profits', COALESCE(SUM(employee_profit), 0),
    'employees_count', 1,  -- المستخدم الحالي فقط
    'orders_count', COUNT(DISTINCT order_id)
  )
  INTO pending_profit_stats
  FROM profits 
  WHERE status = 'pending' 
    AND employee_id = current_user_id;  -- أرباح المستخدم الحالي فقط

  -- إرجاع النتائج
  RETURN QUERY
  SELECT 
    -- إحصائيات عامة للمستخدم الحالي
    (SELECT COUNT(*)::bigint FROM orders WHERE created_by = current_user_id),
    (SELECT COUNT(*)::bigint FROM orders WHERE status = 'pending' AND created_by = current_user_id),
    (SELECT COUNT(*)::bigint FROM orders WHERE status IN ('completed', 'delivered') AND receipt_received = true AND created_by = current_user_id),
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status IN ('completed', 'delivered') AND receipt_received = true AND created_by = current_user_id),
    
    -- البيانات التفصيلية
    COALESCE(customer_stats, '[]'::jsonb),
    COALESCE(product_stats, '[]'::jsonb), 
    COALESCE(province_stats, '[]'::jsonb),
    COALESCE(pending_profit_stats, '{"total_pending_amount":0,"total_employee_profits":0,"employees_count":0,"orders_count":0}'::jsonb);
END;
$$;