-- إصلاح نهائي: إعادة كتابة smart_inventory_search بالأعمدة الموجودة فقط
-- المشكلة: department_id, product_type_id, season_occasion_id غير موجودة في جدول products
-- الحل: استخدام category_id, color_id, size_id فقط

DROP FUNCTION IF EXISTS public.smart_inventory_search(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.smart_inventory_search(
  p_employee_id UUID,
  p_search_text TEXT
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
  barcode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
BEGIN
  -- التحقق من صلاحيات الإدارة
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  -- إذا لم يكن مديراً، نجمع صلاحياته من user_product_permissions
  IF NOT v_is_admin THEN
    -- جمع صلاحيات الفئات (category_id موجود في products)
    SELECT allowed_items, has_full_access 
    INTO v_allowed_categories, v_has_category_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'category'
    LIMIT 1;
    
    -- جمع صلاحيات الألوان (color_id موجود في product_variants)
    SELECT allowed_items, has_full_access 
    INTO v_allowed_colors, v_has_color_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'color'
    LIMIT 1;
    
    -- جمع صلاحيات الأحجام (size_id موجود في product_variants)
    SELECT allowed_items, has_full_access 
    INTO v_allowed_sizes, v_has_size_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'size'
    LIMIT 1;
  END IF;
  
  -- تطبيع نص البحث
  v_normalized_search := LOWER(TRIM(COALESCE(p_search_text, '')));
  
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
    pv.barcode
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    -- فلترة المنتجات حسب صلاحيات الموظف (الأعمدة الموجودة فقط)
    AND (
      v_is_admin
      OR (
        -- تصفية حسب الفئة (category_id موجود)
        (v_has_category_access OR v_allowed_categories IS NULL OR p.category_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_categories)
        ))
        AND
        -- تصفية حسب اللون (color_id موجود في product_variants)
        (v_has_color_access OR v_allowed_colors IS NULL OR pv.color_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_colors)
        ))
        AND
        -- تصفية حسب الحجم (size_id موجود في product_variants)
        (v_has_size_access OR v_allowed_sizes IS NULL OR pv.size_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_sizes)
        ))
      )
    )
    -- فلترة البحث النصي
    AND (
      v_normalized_search = '' 
      OR LOWER(p.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(c.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(s.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(pv.barcode) LIKE '%' || v_normalized_search || '%'
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;