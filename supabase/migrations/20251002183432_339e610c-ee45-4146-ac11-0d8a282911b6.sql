-- ==========================================
-- Phase 1: Smart Inventory System - Database Functions
-- ==========================================

-- Function: Get inventory based on employee permissions
CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id UUID,
  p_search_type TEXT DEFAULT 'all',
  p_search_value TEXT DEFAULT NULL
)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  department_name TEXT,
  category_name TEXT,
  color_id UUID,
  color_name TEXT,
  size_id UUID,
  size_name TEXT,
  variant_id UUID,
  total_quantity INTEGER,
  available_quantity INTEGER,
  reserved_quantity INTEGER,
  sold_quantity INTEGER,
  min_stock INTEGER,
  location TEXT,
  season_occasion TEXT,
  product_type TEXT,
  cost_price NUMERIC,
  sale_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_full_access BOOLEAN := FALSE;
  v_allowed_products UUID[];
  v_allowed_colors UUID[];
  v_allowed_sizes UUID[];
  v_allowed_departments UUID[];
  v_allowed_categories UUID[];
  v_allowed_seasons TEXT[];
  v_allowed_types UUID[];
BEGIN
  -- Check if employee has full access (admin/deputy)
  SELECT is_admin_or_deputy() INTO v_has_full_access;
  
  IF NOT v_has_full_access THEN
    -- Get employee permissions
    SELECT 
      COALESCE(array_agg(DISTINCT upp.product_id) FILTER (WHERE upp.product_id IS NOT NULL), ARRAY[]::UUID[]),
      COALESCE(array_agg(DISTINCT upp.color_id) FILTER (WHERE upp.color_id IS NOT NULL), ARRAY[]::UUID[]),
      COALESCE(array_agg(DISTINCT upp.size_id) FILTER (WHERE upp.size_id IS NOT NULL), ARRAY[]::UUID[]),
      COALESCE(array_agg(DISTINCT upp.department_id) FILTER (WHERE upp.department_id IS NOT NULL), ARRAY[]::UUID[]),
      COALESCE(array_agg(DISTINCT upp.category_id) FILTER (WHERE upp.category_id IS NOT NULL), ARRAY[]::UUID[]),
      COALESCE(array_agg(DISTINCT upp.season_occasion) FILTER (WHERE upp.season_occasion IS NOT NULL), ARRAY[]::TEXT[]),
      COALESCE(array_agg(DISTINCT upp.product_type_id) FILTER (WHERE upp.product_type_id IS NOT NULL), ARRAY[]::UUID[])
    INTO v_allowed_products, v_allowed_colors, v_allowed_sizes, v_allowed_departments, 
         v_allowed_categories, v_allowed_seasons, v_allowed_types
    FROM user_product_permissions upp
    WHERE upp.user_id = p_employee_id AND upp.is_active = TRUE;
  END IF;

  RETURN QUERY
  WITH filtered_products AS (
    SELECT DISTINCT
      p.id as product_id,
      p.name as product_name,
      p.code as product_code,
      d.name as department_name,
      c.name as category_name,
      p.season_occasion,
      p.product_type_id,
      p.cost_price as product_cost_price,
      p.price as product_sale_price
    FROM products p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = TRUE
      AND (
        v_has_full_access = TRUE
        OR p.id = ANY(v_allowed_products)
        OR p.department_id = ANY(v_allowed_departments)
        OR p.category_id = ANY(v_allowed_categories)
        OR p.season_occasion = ANY(v_allowed_seasons)
        OR p.product_type_id = ANY(v_allowed_types)
      )
      AND (
        p_search_type = 'all'
        OR (p_search_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_search_value) || '%')
        OR (p_search_type = 'department' AND LOWER(d.name) LIKE '%' || LOWER(p_search_value) || '%')
        OR (p_search_type = 'category' AND LOWER(c.name) LIKE '%' || LOWER(p_search_value) || '%')
        OR (p_search_type = 'season' AND LOWER(p.season_occasion) LIKE '%' || LOWER(p_search_value) || '%')
      )
  )
  SELECT
    fp.product_id,
    fp.product_name,
    fp.product_code,
    fp.department_name,
    fp.category_name,
    cl.id as color_id,
    cl.name as color_name,
    sz.id as size_id,
    sz.name as size_name,
    pv.id as variant_id,
    COALESCE(inv.quantity, 0) as total_quantity,
    COALESCE(inv.quantity - inv.reserved_quantity, 0) as available_quantity,
    COALESCE(inv.reserved_quantity, 0) as reserved_quantity,
    COALESCE(inv.sold_quantity, 0) as sold_quantity,
    COALESCE(inv.min_stock, 0) as min_stock,
    inv.location,
    fp.season_occasion,
    pt.name as product_type,
    COALESCE(pv.cost_price, fp.product_cost_price) as cost_price,
    COALESCE(pv.price, fp.product_sale_price) as sale_price
  FROM filtered_products fp
  JOIN product_variants pv ON pv.product_id = fp.product_id
  LEFT JOIN colors cl ON pv.color_id = cl.id
  LEFT JOIN sizes sz ON pv.size_id = sz.id
  LEFT JOIN inventory inv ON inv.variant_id = pv.id
  LEFT JOIN product_types pt ON fp.product_type_id = pt.id
  WHERE (
    v_has_full_access = TRUE
    OR (
      (v_allowed_colors = ARRAY[]::UUID[] OR cl.id = ANY(v_allowed_colors))
      AND (v_allowed_sizes = ARRAY[]::UUID[] OR sz.id = ANY(v_allowed_sizes))
    )
  )
  AND (
    p_search_type NOT IN ('color', 'size')
    OR (p_search_type = 'color' AND LOWER(cl.name) LIKE '%' || LOWER(p_search_value) || '%')
    OR (p_search_type = 'size' AND LOWER(sz.name) LIKE '%' || LOWER(p_search_value) || '%')
  )
  ORDER BY fp.product_name, cl.name, sz.name;
END;
$$;

-- Function: Smart compound search for inventory
CREATE OR REPLACE FUNCTION public.smart_inventory_search(
  p_employee_id UUID,
  p_search_text TEXT
)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  department_name TEXT,
  category_name TEXT,
  color_name TEXT,
  size_name TEXT,
  variant_id UUID,
  total_quantity INTEGER,
  available_quantity INTEGER,
  reserved_quantity INTEGER,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_lower TEXT := LOWER(TRIM(p_search_text));
  v_words TEXT[];
BEGIN
  -- Split search text into words
  v_words := string_to_array(v_search_lower, ' ');
  
  RETURN QUERY
  WITH inventory_data AS (
    SELECT * FROM get_inventory_by_permissions(p_employee_id, 'all', NULL)
  )
  SELECT
    inv.product_id,
    inv.product_name,
    inv.department_name,
    inv.category_name,
    inv.color_name,
    inv.size_name,
    inv.variant_id,
    inv.total_quantity,
    inv.available_quantity,
    inv.reserved_quantity,
    (
      CASE WHEN LOWER(inv.product_name) = v_search_lower THEN 100 ELSE 0 END +
      CASE WHEN LOWER(inv.product_name) LIKE v_search_lower || '%' THEN 50 ELSE 0 END +
      CASE WHEN LOWER(inv.product_name) LIKE '%' || v_search_lower || '%' THEN 30 ELSE 0 END +
      CASE WHEN LOWER(inv.color_name) LIKE '%' || v_search_lower || '%' THEN 25 ELSE 0 END +
      CASE WHEN LOWER(inv.size_name) = v_search_lower THEN 25 ELSE 0 END +
      CASE WHEN LOWER(inv.department_name) LIKE '%' || v_search_lower || '%' THEN 20 ELSE 0 END +
      CASE WHEN LOWER(inv.category_name) LIKE '%' || v_search_lower || '%' THEN 15 ELSE 0 END +
      -- Multi-word matching
      (SELECT COUNT(*) * 10 FROM unnest(v_words) w 
       WHERE LOWER(inv.product_name) LIKE '%' || w || '%'
          OR LOWER(inv.color_name) LIKE '%' || w || '%'
          OR LOWER(inv.size_name) LIKE '%' || w || '%'
          OR LOWER(inv.department_name) LIKE '%' || w || '%')
    ) as match_score
  FROM inventory_data inv
  WHERE (
    LOWER(inv.product_name) LIKE '%' || v_search_lower || '%'
    OR LOWER(inv.color_name) LIKE '%' || v_search_lower || '%'
    OR LOWER(inv.size_name) LIKE '%' || v_search_lower || '%'
    OR LOWER(inv.department_name) LIKE '%' || v_search_lower || '%'
    OR LOWER(inv.category_name) LIKE '%' || v_search_lower || '%'
    OR EXISTS (
      SELECT 1 FROM unnest(v_words) w
      WHERE LOWER(inv.product_name) LIKE '%' || w || '%'
         OR LOWER(inv.color_name) LIKE '%' || w || '%'
         OR LOWER(inv.size_name) LIKE '%' || w || '%'
    )
  )
  ORDER BY match_score DESC, inv.product_name, inv.color_name, inv.size_name
  LIMIT 50;
END;
$$;

-- Function: Get inventory summary statistics for employee
CREATE OR REPLACE FUNCTION public.get_employee_inventory_stats(
  p_employee_id UUID
)
RETURNS TABLE(
  total_products INTEGER,
  total_variants INTEGER,
  total_stock INTEGER,
  available_stock INTEGER,
  reserved_stock INTEGER,
  low_stock_items INTEGER,
  out_of_stock_items INTEGER,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH inventory_data AS (
    SELECT * FROM get_inventory_by_permissions(p_employee_id, 'all', NULL)
  )
  SELECT
    COUNT(DISTINCT product_id)::INTEGER as total_products,
    COUNT(DISTINCT variant_id)::INTEGER as total_variants,
    SUM(total_quantity)::INTEGER as total_stock,
    SUM(available_quantity)::INTEGER as available_stock,
    SUM(reserved_quantity)::INTEGER as reserved_stock,
    COUNT(*) FILTER (WHERE total_quantity <= min_stock AND total_quantity > 0)::INTEGER as low_stock_items,
    COUNT(*) FILTER (WHERE total_quantity = 0)::INTEGER as out_of_stock_items,
    SUM(total_quantity * cost_price) as total_value
  FROM inventory_data;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_inventory_by_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.smart_inventory_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_inventory_stats TO authenticated;