-- حذف الـ functions القديمة المعطوبة
DROP FUNCTION IF EXISTS get_inventory_by_permissions(uuid);
DROP FUNCTION IF EXISTS smart_inventory_search(uuid, text);
DROP FUNCTION IF EXISTS get_employee_inventory_stats(uuid);

-- ===================================
-- 1. دالة للحصول على المخزون حسب الصلاحيات
-- ===================================
CREATE OR REPLACE FUNCTION get_inventory_by_permissions(p_employee_id uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  variant_id uuid,
  color_name text,
  size_name text,
  available_quantity integer,
  reserved_quantity integer,
  total_quantity integer,
  department_name text,
  category_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_has_category_permission boolean;
  v_has_department_permission boolean;
  v_has_product_type_permission boolean;
  v_has_season_permission boolean;
  v_has_color_permission boolean;
  v_has_size_permission boolean;
BEGIN
  -- فحص إذا كان المستخدم admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_employee_id 
    AND r.name IN ('super_admin', 'admin')
    AND ur.is_active = true
  ) INTO v_is_admin;

  -- إذا كان admin، إرجاع كل المخزون
  IF v_is_admin THEN
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      pv.id as variant_id,
      c.name as color_name,
      s.name as size_name,
      COALESCE(i.quantity - i.reserved_quantity, 0)::integer as available_quantity,
      COALESCE(i.reserved_quantity, 0)::integer as reserved_quantity,
      COALESCE(i.quantity, 0)::integer as total_quantity,
      d.name as department_name,
      cat.name as category_name
    FROM products p
    JOIN product_variants pv ON p.id = pv.product_id
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    LEFT JOIN product_departments pd ON p.id = pd.product_id
    LEFT JOIN departments d ON pd.department_id = d.id
    LEFT JOIN product_categories pc ON p.id = pc.product_id
    LEFT JOIN categories cat ON pc.category_id = cat.id
    WHERE p.is_active = true
    ORDER BY p.name, c.name, s.name;
    RETURN;
  END IF;

  -- فحص أنواع الصلاحيات الموجودة
  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'category'
  ) INTO v_has_category_permission;

  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'department'
  ) INTO v_has_department_permission;

  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'product_type'
  ) INTO v_has_product_type_permission;

  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'season_occasion'
  ) INTO v_has_season_permission;

  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'color'
  ) INTO v_has_color_permission;

  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions
    WHERE user_id = p_employee_id AND permission_type = 'size'
  ) INTO v_has_size_permission;

  -- إرجاع المخزون المفلتر حسب الصلاحيات
  RETURN QUERY
  SELECT DISTINCT
    p.id as product_id,
    p.name as product_name,
    pv.id as variant_id,
    c.name as color_name,
    s.name as size_name,
    COALESCE(i.quantity - i.reserved_quantity, 0)::integer as available_quantity,
    COALESCE(i.reserved_quantity, 0)::integer as reserved_quantity,
    COALESCE(i.quantity, 0)::integer as total_quantity,
    d.name as department_name,
    cat.name as category_name
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  JOIN colors c ON pv.color_id = c.id
  JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  LEFT JOIN product_departments pd ON p.id = pd.product_id
  LEFT JOIN departments d ON pd.department_id = d.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN categories cat ON pc.category_id = cat.id
  WHERE p.is_active = true
  -- فلترة Categories
  AND (
    NOT v_has_category_permission 
    OR EXISTS (
      SELECT 1 FROM user_product_permissions upp
      JOIN product_categories pc2 ON pc2.product_id = p.id
      WHERE upp.user_id = p_employee_id 
      AND upp.permission_type = 'category'
      AND (upp.has_full_access = true OR pc2.category_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items)))
    )
  )
  -- فلترة Departments
  AND (
    NOT v_has_department_permission
    OR EXISTS (
      SELECT 1 FROM user_product_permissions upp
      JOIN product_departments pd2 ON pd2.product_id = p.id
      WHERE upp.user_id = p_employee_id
      AND upp.permission_type = 'department'
      AND (upp.has_full_access = true OR pd2.department_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items)))
    )
  )
  -- فلترة Product Types
  AND (
    NOT v_has_product_type_permission
    OR EXISTS (
      SELECT 1 FROM user_product_permissions upp
      JOIN product_product_types ppt ON ppt.product_id = p.id
      WHERE upp.user_id = p_employee_id
      AND upp.permission_type = 'product_type'
      AND (upp.has_full_access = true OR ppt.product_type_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items)))
    )
  )
  -- فلترة Seasons
  AND (
    NOT v_has_season_permission
    OR EXISTS (
      SELECT 1 FROM user_product_permissions upp
      JOIN product_seasons ps ON ps.product_id = p.id
      WHERE upp.user_id = p_employee_id
      AND upp.permission_type = 'season_occasion'
      AND (upp.has_full_access = true OR ps.season_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items)))
    )
  )
  -- فلترة Colors
  AND (
    NOT v_has_color_permission
    OR EXISTS (
      SELECT 1 FROM user_product_permissions upp
      WHERE upp.user_id = p_employee_id
      AND upp.permission_type = 'color'
      AND (upp.has_full_access = true OR pv.color_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items)))
    )
  )
  -- فلترة Sizes
  AND (
    NOT v_has_size_permission
    OR EXISTS (
      SELECT 1 FROM user_product_permissions upp
      WHERE upp.user_id = p_employee_id
      AND upp.permission_type = 'size'
      AND (upp.has_full_access = true OR pv.size_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items)))
    )
  )
  ORDER BY p.name, c.name, s.name;
END;
$$;

-- ===================================
-- 2. دالة البحث الذكي في المخزون
-- ===================================
CREATE OR REPLACE FUNCTION smart_inventory_search(
  p_employee_id uuid,
  p_search_text text
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  variant_id uuid,
  color_name text,
  size_name text,
  available_quantity integer,
  reserved_quantity integer,
  total_quantity integer,
  department_name text,
  category_name text,
  match_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_lower text;
BEGIN
  v_search_lower := lower(trim(p_search_text));

  RETURN QUERY
  SELECT 
    inv.product_id,
    inv.product_name,
    inv.variant_id,
    inv.color_name,
    inv.size_name,
    inv.available_quantity,
    inv.reserved_quantity,
    inv.total_quantity,
    inv.department_name,
    inv.category_name,
    -- حساب نقاط التطابق
    (
      CASE WHEN lower(inv.product_name) = v_search_lower THEN 100
           WHEN lower(inv.product_name) LIKE v_search_lower || '%' THEN 90
           WHEN lower(inv.product_name) LIKE '%' || v_search_lower || '%' THEN 80
           ELSE 0 END +
      CASE WHEN lower(inv.color_name) = v_search_lower THEN 50
           WHEN lower(inv.color_name) LIKE '%' || v_search_lower || '%' THEN 40
           ELSE 0 END +
      CASE WHEN lower(inv.size_name) = v_search_lower THEN 30
           WHEN lower(inv.size_name) LIKE '%' || v_search_lower || '%' THEN 20
           ELSE 0 END +
      CASE WHEN lower(inv.department_name) LIKE '%' || v_search_lower || '%' THEN 15 ELSE 0 END +
      CASE WHEN lower(inv.category_name) LIKE '%' || v_search_lower || '%' THEN 10 ELSE 0 END
    )::integer as match_score
  FROM get_inventory_by_permissions(p_employee_id) inv
  WHERE 
    lower(inv.product_name) LIKE '%' || v_search_lower || '%'
    OR lower(inv.color_name) LIKE '%' || v_search_lower || '%'
    OR lower(inv.size_name) LIKE '%' || v_search_lower || '%'
    OR lower(inv.department_name) LIKE '%' || v_search_lower || '%'
    OR lower(inv.category_name) LIKE '%' || v_search_lower || '%'
  ORDER BY match_score DESC, inv.product_name, inv.color_name, inv.size_name
  LIMIT 50;
END;
$$;

-- ===================================
-- 3. دالة إحصائيات المخزون للموظف
-- ===================================
CREATE OR REPLACE FUNCTION get_employee_inventory_stats(p_employee_id uuid)
RETURNS TABLE (
  total_products bigint,
  total_variants bigint,
  total_available_quantity bigint,
  total_reserved_quantity bigint,
  total_quantity bigint,
  low_stock_variants bigint,
  out_of_stock_variants bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT inv.product_id) as total_products,
    COUNT(DISTINCT inv.variant_id) as total_variants,
    COALESCE(SUM(inv.available_quantity), 0) as total_available_quantity,
    COALESCE(SUM(inv.reserved_quantity), 0) as total_reserved_quantity,
    COALESCE(SUM(inv.total_quantity), 0) as total_quantity,
    COUNT(DISTINCT inv.variant_id) FILTER (WHERE inv.available_quantity > 0 AND inv.available_quantity <= 5) as low_stock_variants,
    COUNT(DISTINCT inv.variant_id) FILTER (WHERE inv.available_quantity = 0) as out_of_stock_variants
  FROM get_inventory_by_permissions(p_employee_id) inv;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION get_inventory_by_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION smart_inventory_search(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_inventory_stats(uuid) TO authenticated;