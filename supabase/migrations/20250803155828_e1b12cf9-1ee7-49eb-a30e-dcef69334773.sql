-- إنشاء دالة موحدة لإحصائيات المخزون
CREATE OR REPLACE FUNCTION public.get_inventory_stats()
RETURNS TABLE(
  total_products bigint,
  total_variants bigint,
  high_stock_count bigint,
  medium_stock_count bigint,
  low_stock_count bigint,
  out_of_stock_count bigint,
  reserved_stock_count bigint,
  archived_products_count bigint,
  total_inventory_value numeric,
  departments_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  dept_data jsonb;
BEGIN
  -- جلب بيانات الأقسام مع عدد المنتجات
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'description', d.description,
      'icon', d.icon,
      'color', d.color,
      'display_order', d.display_order,
      'product_count', COALESCE(dept_products.product_count, 0)
    ) ORDER BY d.display_order, d.name
  ) INTO dept_data
  FROM departments d
  LEFT JOIN (
    SELECT 
      pd.department_id,
      COUNT(DISTINCT pd.product_id) as product_count
    FROM product_departments pd
    JOIN products p ON pd.product_id = p.id
    WHERE p.is_active = true
    GROUP BY pd.department_id
  ) dept_products ON d.id = dept_products.department_id
  WHERE d.is_active = true;

  RETURN QUERY
  WITH inventory_stats AS (
    SELECT 
      COUNT(DISTINCT i.product_id) as total_products,
      COUNT(i.id) as total_variants,
      SUM(CASE WHEN i.quantity >= 10 THEN 1 ELSE 0 END) as high_stock_count,
      SUM(CASE WHEN i.quantity >= 5 AND i.quantity < 10 THEN 1 ELSE 0 END) as medium_stock_count,
      SUM(CASE WHEN i.quantity > 0 AND i.quantity < 5 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN i.quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
      COALESCE(SUM(i.reserved_quantity), 0) as reserved_stock_count,
      -- المنتجات المؤرشفة (التي جميع مقاساتها نافذة)
      COUNT(DISTINCT CASE 
        WHEN p.id IN (
          SELECT DISTINCT product_id 
          FROM inventory i2 
          WHERE i2.product_id = p.id 
          GROUP BY product_id 
          HAVING SUM(i2.quantity) = 0
        ) THEN p.id 
        ELSE NULL 
      END) as archived_products_count,
      -- قيمة المخزون الإجمالية
      COALESCE(SUM(i.quantity * pv.cost_price), 0) as total_inventory_value
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN product_variants pv ON i.variant_id = pv.id
    WHERE p.is_active = true
  )
  SELECT 
    is_data.total_products,
    is_data.total_variants,
    is_data.high_stock_count,
    is_data.medium_stock_count,
    is_data.low_stock_count,
    is_data.out_of_stock_count,
    is_data.reserved_stock_count,
    is_data.archived_products_count,
    is_data.total_inventory_value,
    dept_data as departments_data
  FROM inventory_stats is_data;
END;
$function$;