-- إنشاء دالة موحدة لإحصائيات المخزون
CREATE OR REPLACE FUNCTION public.get_inventory_stats(
  p_department_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  total_products BIGINT,
  total_variants BIGINT,
  total_quantity BIGINT,
  total_cost_value NUMERIC,
  total_sale_value NUMERIC,
  total_expected_profit NUMERIC,
  reserved_quantity BIGINT,
  high_stock_count BIGINT,
  medium_stock_count BIGINT,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  archived_products_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_inventory AS (
    SELECT 
      i.product_id,
      i.variant_id,
      i.quantity,
      i.reserved_quantity,
      pv.cost_price,
      pv.sale_price,
      p.is_active,
      CASE 
        WHEN i.quantity = 0 THEN 'out_of_stock'
        WHEN i.quantity <= 5 THEN 'low_stock'
        WHEN i.quantity <= 20 THEN 'medium_stock'
        ELSE 'high_stock'
      END as stock_level
    FROM inventory i
    LEFT JOIN product_variants pv ON i.variant_id = pv.id
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN product_categories pc ON p.id = pc.product_id
    LEFT JOIN product_departments pd ON p.id = pd.product_id
    WHERE (
      p_department_ids IS NULL OR 
      EXISTS (SELECT 1 FROM product_departments WHERE product_id = p.id AND department_id = ANY(p_department_ids))
    )
    AND (
      p_category_ids IS NULL OR 
      EXISTS (SELECT 1 FROM product_categories WHERE product_id = p.id AND category_id = ANY(p_category_ids))
    )
  )
  SELECT 
    COUNT(DISTINCT fi.product_id)::BIGINT,
    COUNT(fi.variant_id)::BIGINT,
    COALESCE(SUM(fi.quantity), 0)::BIGINT,
    COALESCE(SUM(fi.quantity * fi.cost_price), 0),
    COALESCE(SUM(fi.quantity * fi.sale_price), 0),
    COALESCE(SUM(fi.quantity * (fi.sale_price - fi.cost_price)), 0),
    COALESCE(SUM(fi.reserved_quantity), 0)::BIGINT,
    COUNT(CASE WHEN fi.stock_level = 'high_stock' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN fi.stock_level = 'medium_stock' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN fi.stock_level = 'low_stock' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN fi.stock_level = 'out_of_stock' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN fi.is_active = false THEN 1 END)::BIGINT
  FROM filtered_inventory fi;
END;
$function$;