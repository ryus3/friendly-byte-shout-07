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