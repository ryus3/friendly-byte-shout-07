-- ==========================================
-- Phase 1-3: إصلاح شامل لجميع database functions
-- ==========================================

-- 1️⃣ إصلاح get_inventory_by_permissions
DROP FUNCTION IF EXISTS get_inventory_by_permissions(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_inventory_by_permissions(
  p_employee_id UUID,
  p_filter_type TEXT DEFAULT NULL,
  p_filter_value TEXT DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category_name TEXT,
  department_name TEXT,
  color_name TEXT,
  size_name TEXT,
  available_quantity INTEGER,
  reserved_quantity INTEGER,
  total_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_has_product_access BOOLEAN := FALSE;
  v_has_category_access BOOLEAN := FALSE;
  v_has_color_access BOOLEAN := FALSE;
  v_has_size_access BOOLEAN := FALSE;
BEGIN
  -- فحص إذا كان المستخدم admin
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  -- إذا كان admin، أرجع كل شيء
  IF v_is_admin THEN
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      COALESCE(cat.name, 'غير محدد') as category_name,
      NULL::text as department_name,
      COALESCE(c.name, 'افتراضي') as color_name,
      COALESCE(s.name, 'افتراضي') as size_name,
      COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.quantity, 0) as total_quantity
    FROM products p
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND (p_filter_type IS NULL OR 
        (p_filter_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%')
      )
    ORDER BY p.name, c.name, s.name;
    RETURN;
  END IF;
  
  -- للموظفين العاديين: فحص الصلاحيات
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    COALESCE(cat.name, 'غير محدد') as category_name,
    NULL::text as department_name,
    COALESCE(c.name, 'افتراضي') as color_name,
    COALESCE(s.name, 'افتراضي') as size_name,
    COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
    COALESCE(i.reserved_quantity, 0) as reserved_quantity,
    COALESCE(i.quantity, 0) as total_quantity
  FROM products p
  LEFT JOIN categories cat ON p.category_id = cat.id
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    -- فحص صلاحية المنتج
    AND (
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'products'
          AND (
            upp.has_full_access = true
            OR p.id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items))
          )
      )
    )
    -- فحص صلاحية التصنيف
    AND (
      p.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'category'
          AND (
            upp.has_full_access = true
            OR p.category_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items))
          )
      )
    )
    -- فحص صلاحية اللون
    AND (
      pv.color_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'color'
          AND (
            upp.has_full_access = true
            OR pv.color_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items))
          )
      )
    )
    -- فحص صلاحية القياس
    AND (
      pv.size_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'size'
          AND (
            upp.has_full_access = true
            OR pv.size_id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items))
          )
      )
    )
    -- تطبيق الفلتر المطلوب
    AND (p_filter_type IS NULL OR 
      (p_filter_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%')
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;

-- 2️⃣ إصلاح get_employee_inventory_stats
DROP FUNCTION IF EXISTS get_employee_inventory_stats(UUID);

CREATE OR REPLACE FUNCTION get_employee_inventory_stats(p_employee_id UUID)
RETURNS TABLE (
  total_products INTEGER,
  available_stock INTEGER,
  reserved_stock INTEGER,
  total_stock INTEGER,
  low_stock_products INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  IF v_is_admin THEN
    -- المديرون يرون كل شيء
    RETURN QUERY
    SELECT 
      COUNT(DISTINCT p.id)::INTEGER as total_products,
      COALESCE(SUM(i.quantity - i.reserved_quantity), 0)::INTEGER as available_stock,
      COALESCE(SUM(i.reserved_quantity), 0)::INTEGER as reserved_stock,
      COALESCE(SUM(i.quantity), 0)::INTEGER as total_stock,
      COUNT(DISTINCT CASE WHEN (i.quantity - i.reserved_quantity) <= i.min_stock THEN p.id END)::INTEGER as low_stock_products
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true;
  ELSE
    -- الموظفون يرون حسب صلاحياتهم
    RETURN QUERY
    SELECT 
      COUNT(DISTINCT p.id)::INTEGER as total_products,
      COALESCE(SUM(i.quantity - i.reserved_quantity), 0)::INTEGER as available_stock,
      COALESCE(SUM(i.reserved_quantity), 0)::INTEGER as reserved_stock,
      COALESCE(SUM(i.quantity), 0)::INTEGER as total_stock,
      COUNT(DISTINCT CASE WHEN (i.quantity - i.reserved_quantity) <= i.min_stock THEN p.id END)::INTEGER as low_stock_products
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'products'
          AND (
            upp.has_full_access = true
            OR p.id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items))
          )
      );
  END IF;
END;
$$;

-- 3️⃣ إصلاح smart_inventory_search
DROP FUNCTION IF EXISTS smart_inventory_search(UUID, TEXT);

CREATE OR REPLACE FUNCTION smart_inventory_search(
  p_employee_id UUID,
  p_search_query TEXT
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category_name TEXT,
  color_name TEXT,
  size_name TEXT,
  available_quantity INTEGER,
  reserved_quantity INTEGER,
  total_quantity INTEGER,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  IF v_is_admin THEN
    -- المديرون يرون كل شيء
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      COALESCE(cat.name, 'غير محدد') as category_name,
      COALESCE(c.name, 'افتراضي') as color_name,
      COALESCE(s.name, 'افتراضي') as size_name,
      COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.quantity, 0) as total_quantity,
      (
        CASE WHEN LOWER(p.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 10 ELSE 0 END +
        CASE WHEN LOWER(cat.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 5 ELSE 0 END +
        CASE WHEN LOWER(c.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 3 ELSE 0 END +
        CASE WHEN LOWER(s.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 2 ELSE 0 END
      ) as match_score
    FROM products p
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND (
        LOWER(p.name) LIKE '%' || LOWER(p_search_query) || '%' OR
        LOWER(cat.name) LIKE '%' || LOWER(p_search_query) || '%' OR
        LOWER(c.name) LIKE '%' || LOWER(p_search_query) || '%' OR
        LOWER(s.name) LIKE '%' || LOWER(p_search_query) || '%'
      )
    ORDER BY match_score DESC, p.name, c.name, s.name;
  ELSE
    -- الموظفون يرون حسب صلاحياتهم
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      COALESCE(cat.name, 'غير محدد') as category_name,
      COALESCE(c.name, 'افتراضي') as color_name,
      COALESCE(s.name, 'افتراضي') as size_name,
      COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.quantity, 0) as total_quantity,
      (
        CASE WHEN LOWER(p.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 10 ELSE 0 END +
        CASE WHEN LOWER(cat.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 5 ELSE 0 END +
        CASE WHEN LOWER(c.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 3 ELSE 0 END +
        CASE WHEN LOWER(s.name) LIKE '%' || LOWER(p_search_query) || '%' THEN 2 ELSE 0 END
      ) as match_score
    FROM products p
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'products'
          AND (
            upp.has_full_access = true
            OR p.id::text = ANY(SELECT jsonb_array_elements_text(upp.allowed_items))
          )
      )
      AND (
        LOWER(p.name) LIKE '%' || LOWER(p_search_query) || '%' OR
        LOWER(cat.name) LIKE '%' || LOWER(p_search_query) || '%' OR
        LOWER(c.name) LIKE '%' || LOWER(p_search_query) || '%' OR
        LOWER(s.name) LIKE '%' || LOWER(p_search_query) || '%'
      )
    ORDER BY match_score DESC, p.name, c.name, s.name;
  END IF;
END;
$$;