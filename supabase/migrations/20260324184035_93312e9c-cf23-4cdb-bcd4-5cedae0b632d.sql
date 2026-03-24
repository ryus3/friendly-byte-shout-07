CREATE OR REPLACE FUNCTION smart_inventory_search(
  p_employee_id UUID DEFAULT NULL,
  p_search_text TEXT DEFAULT ''
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  color_id UUID,
  color_name TEXT,
  size_id UUID,
  size_name TEXT,
  variant_id UUID,
  available_quantity INTEGER,
  reserved_quantity INTEGER,
  price NUMERIC,
  cost_price NUMERIC,
  barcode TEXT,
  category_name TEXT,
  season_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_allowed_categories JSONB := NULL;
  v_allowed_colors JSONB := NULL;
  v_allowed_sizes JSONB := NULL;
  v_has_category_access BOOLEAN := TRUE;
  v_has_color_access BOOLEAN := TRUE;
  v_has_size_access BOOLEAN := TRUE;
  v_normalized_search TEXT;
  v_size_normalized TEXT;
BEGIN
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    SELECT allowed_items, has_full_access 
    INTO v_allowed_categories, v_has_category_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'category'
    LIMIT 1;
    
    SELECT allowed_items, has_full_access 
    INTO v_allowed_colors, v_has_color_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'color'
    LIMIT 1;
    
    SELECT allowed_items, has_full_access 
    INTO v_allowed_sizes, v_has_size_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'size'
    LIMIT 1;
  END IF;
  
  v_normalized_search := LOWER(TRIM(COALESCE(p_search_text, '')));
  
  v_size_normalized := CASE v_normalized_search
    WHEN 'سمول' THEN 's'
    WHEN 's' THEN 's'
    WHEN 'ميديم' THEN 'm'
    WHEN 'مديم' THEN 'm'
    WHEN 'm' THEN 'm'
    WHEN 'لارج' THEN 'l'
    WHEN 'l' THEN 'l'
    WHEN 'اكس' THEN 'xl'
    WHEN 'xl' THEN 'xl'
    WHEN 'اكس لارج' THEN 'xl'
    WHEN 'اكسلارج' THEN 'xl'
    WHEN 'اكسين' THEN 'xxl'
    WHEN 'xxl' THEN 'xxl'
    WHEN 'اكسين لارج' THEN 'xxl'
    WHEN 'اكسينلارج' THEN 'xxl'
    WHEN '3 اكس' THEN 'xxxl'
    WHEN '3 اكسات' THEN 'xxxl'
    WHEN 'ثلاث اكسات' THEN 'xxxl'
    WHEN 'ثلاثة اكس' THEN 'xxxl'
    WHEN 'xxxl' THEN 'xxxl'
    WHEN '3xl' THEN 'xxxl'
    ELSE v_normalized_search
  END;
  
  RETURN QUERY
  SELECT DISTINCT
    p.id AS product_id,
    p.name AS product_name,
    c.id AS color_id,
    c.name AS color_name,
    s.id AS size_id,
    s.name AS size_name,
    pv.id AS variant_id,
    COALESCE(i.quantity - i.reserved_quantity, 0)::INTEGER AS available_quantity,
    COALESCE(i.reserved_quantity, 0)::INTEGER AS reserved_quantity,
    pv.price,
    COALESCE(pv.cost_price, p.cost_price, 0) AS cost_price,
    pv.barcode,
    cat.name AS category_name,
    so.name AS season_name
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN categories cat ON pc.category_id = cat.id
  LEFT JOIN product_seasons_occasions pso ON p.id = pso.product_id
  LEFT JOIN seasons_occasions so ON pso.season_occasion_id = so.id
  WHERE p.is_active = true
    AND (
      v_is_admin
      OR (
        (v_has_category_access OR v_allowed_categories IS NULL OR pc.category_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_categories)
        ))
        AND
        (v_has_color_access OR v_allowed_colors IS NULL OR pv.color_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_colors)
        ))
        AND
        (v_has_size_access OR v_allowed_sizes IS NULL OR pv.size_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_sizes)
        ))
      )
    )
    AND (
      v_normalized_search = '' 
      OR LOWER(p.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(c.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(s.name) LIKE '%' || v_size_normalized || '%'
      OR LOWER(pv.barcode) LIKE '%' || v_normalized_search || '%'
      OR LOWER(cat.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(so.name) LIKE '%' || v_normalized_search || '%'
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;