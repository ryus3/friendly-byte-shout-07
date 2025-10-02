-- إصلاح جذري نهائي: استخدام نظام الصلاحيات الموجود بدلاً من employee_department_permissions
-- المشكلة: الدالة تحاول الوصول لجدول employee_department_permissions غير الموجود
-- الحل: استخدام user_product_permissions (النظام الفعلي المستخدم في الموقع)

-- حذف النسخة القديمة
DROP FUNCTION IF EXISTS public.smart_inventory_search(UUID, TEXT);

-- إنشاء النسخة الجديدة مع نظام الصلاحيات الصحيح
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
  barcode TEXT,
  image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_allowed_categories JSONB := NULL;
  v_allowed_departments JSONB := NULL;
  v_allowed_product_types JSONB := NULL;
  v_allowed_seasons JSONB := NULL;
  v_allowed_colors JSONB := NULL;
  v_allowed_sizes JSONB := NULL;
  v_has_category_access BOOLEAN := TRUE;
  v_has_department_access BOOLEAN := TRUE;
  v_has_type_access BOOLEAN := TRUE;
  v_has_season_access BOOLEAN := TRUE;
  v_has_color_access BOOLEAN := TRUE;
  v_has_size_access BOOLEAN := TRUE;
  v_normalized_search TEXT;
BEGIN
  -- التحقق من صلاحيات الإدارة
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  -- إذا لم يكن مديراً، نجمع صلاحياته من user_product_permissions
  IF NOT v_is_admin THEN
    -- جمع صلاحيات الفئات
    SELECT allowed_items, has_full_access 
    INTO v_allowed_categories, v_has_category_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'category'
    LIMIT 1;
    
    -- جمع صلاحيات الأقسام
    SELECT allowed_items, has_full_access 
    INTO v_allowed_departments, v_has_department_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'department'
    LIMIT 1;
    
    -- جمع صلاحيات أنواع المنتجات
    SELECT allowed_items, has_full_access 
    INTO v_allowed_product_types, v_has_type_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'product_type'
    LIMIT 1;
    
    -- جمع صلاحيات المواسم/المناسبات
    SELECT allowed_items, has_full_access 
    INTO v_allowed_seasons, v_has_season_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'season_occasion'
    LIMIT 1;
    
    -- جمع صلاحيات الألوان
    SELECT allowed_items, has_full_access 
    INTO v_allowed_colors, v_has_color_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'color'
    LIMIT 1;
    
    -- جمع صلاحيات الأحجام
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
    pv.barcode,
    p.image_url
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    -- فلترة المنتجات حسب صلاحيات الموظف (نفس منطق useFilteredProducts)
    AND (
      v_is_admin -- المديرون يرون جميع المنتجات
      OR (
        -- فلترة الفئات (categories)
        (v_has_category_access OR v_allowed_categories IS NULL OR p.category_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_categories)
        ))
        AND
        -- فلترة الأقسام (departments)
        (v_has_department_access OR v_allowed_departments IS NULL OR p.department_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_departments)
        ))
        AND
        -- فلترة أنواع المنتجات (product_types)
        (v_has_type_access OR v_allowed_product_types IS NULL OR p.product_type_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_product_types)
        ))
        AND
        -- فلترة المواسم/المناسبات (seasons_occasions)
        (v_has_season_access OR v_allowed_seasons IS NULL OR p.season_occasion_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_seasons)
        ))
        AND
        -- فلترة الألوان (للمتغيرات)
        (v_has_color_access OR v_allowed_colors IS NULL OR pv.color_id::text = ANY(
          SELECT jsonb_array_elements_text(v_allowed_colors)
        ))
        AND
        -- فلترة الأحجام (للمتغيرات)
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