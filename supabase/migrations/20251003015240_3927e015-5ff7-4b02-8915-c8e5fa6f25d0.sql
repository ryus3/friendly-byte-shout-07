-- حذف الدالة الحالية التي تستقبل p_user_id
DROP FUNCTION IF EXISTS get_unified_inventory_stats(uuid);

-- إعادة إنشاء النسخة الأصلية البسيطة بدون parameters
CREATE OR REPLACE FUNCTION get_unified_inventory_stats()
RETURNS TABLE (
  total_products BIGINT,
  total_variants BIGINT,
  high_stock_count BIGINT,
  medium_stock_count BIGINT,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  archived_products_count BIGINT,
  total_inventory_value NUMERIC,
  departments_data JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH inventory_stats AS (
    SELECT 
      p.id as product_id,
      p.is_active,
      COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_stock,
      COALESCE(SUM(i.quantity * COALESCE(pv.price, p.price, 0)), 0) as product_value
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    GROUP BY p.id, p.is_active
  ),
  stock_levels AS (
    SELECT 
      COUNT(*) FILTER (WHERE available_stock > 50) as high,
      COUNT(*) FILTER (WHERE available_stock > 10 AND available_stock <= 50) as medium,
      COUNT(*) FILTER (WHERE available_stock > 0 AND available_stock <= 10) as low,
      COUNT(*) FILTER (WHERE available_stock = 0) as out,
      COUNT(*) FILTER (WHERE NOT is_active) as archived,
      SUM(product_value) as total_value
    FROM inventory_stats
  ),
  dept_stats AS (
    SELECT 
      d.id,
      d.name,
      d.color,
      d.icon,
      COUNT(DISTINCT pd.product_id) as product_count,
      COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as total_quantity
    FROM departments d
    LEFT JOIN product_departments pd ON d.id = pd.department_id
    LEFT JOIN products p ON pd.product_id = p.id AND p.is_active = true
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE d.is_active = true
    GROUP BY d.id, d.name, d.color, d.icon
  )
  SELECT 
    (SELECT COUNT(DISTINCT id) FROM products WHERE is_active = true)::BIGINT as total_products,
    (SELECT COUNT(*) FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE p.is_active = true)::BIGINT as total_variants,
    COALESCE((SELECT high FROM stock_levels), 0)::BIGINT as high_stock_count,
    COALESCE((SELECT medium FROM stock_levels), 0)::BIGINT as medium_stock_count,
    COALESCE((SELECT low FROM stock_levels), 0)::BIGINT as low_stock_count,
    COALESCE((SELECT out FROM stock_levels), 0)::BIGINT as out_stock_count,
    COALESCE((SELECT archived FROM stock_levels), 0)::BIGINT as archived_products_count,
    COALESCE((SELECT total_value FROM stock_levels), 0)::NUMERIC as total_inventory_value,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'color', color,
          'icon', icon,
          'product_count', product_count,
          'total_quantity', total_quantity
        )
      )
      FROM dept_stats
    ), '[]'::jsonb) as departments_data;
END;
$$;