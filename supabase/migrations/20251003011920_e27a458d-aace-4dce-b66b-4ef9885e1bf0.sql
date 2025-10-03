-- حذف الدالة القديمة وإعادة إنشائها مع الإصلاح
DROP FUNCTION IF EXISTS get_unified_inventory_stats(uuid);

CREATE OR REPLACE FUNCTION get_unified_inventory_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_products int := 0;
  v_low_stock int := 0;
  v_out_of_stock int := 0;
  v_reserved int := 0;
  v_available int := 0;
  v_total_value numeric := 0;
  v_departments jsonb := '[]'::jsonb;
  
  -- صلاحيات المستخدم
  v_product_full_access boolean := false;
  v_color_full_access boolean := false;
  v_size_full_access boolean := false;
  v_category_full_access boolean := false;
  v_department_full_access boolean := false;
  v_season_full_access boolean := false;
  
  v_product_items jsonb := '[]'::jsonb;
  v_color_items jsonb := '[]'::jsonb;
  v_size_items jsonb := '[]'::jsonb;
  v_category_items jsonb := '[]'::jsonb;
  v_department_items jsonb := '[]'::jsonb;
  v_season_items jsonb := '[]'::jsonb;
BEGIN
  -- 1. جلب صلاحيات المنتجات
  SELECT 
    COALESCE(bool_or(full_access), false),
    COALESCE(jsonb_agg(DISTINCT item_id) FILTER (WHERE item_id IS NOT NULL AND full_access = false), '[]'::jsonb)
  INTO v_product_full_access, v_product_items
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'product' AND is_active = true;

  -- 2. جلب صلاحيات الألوان
  SELECT 
    COALESCE(bool_or(full_access), false),
    COALESCE(jsonb_agg(DISTINCT item_id) FILTER (WHERE item_id IS NOT NULL AND full_access = false), '[]'::jsonb)
  INTO v_color_full_access, v_color_items
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'color' AND is_active = true;

  -- 3. جلب صلاحيات الأحجام
  SELECT 
    COALESCE(bool_or(full_access), false),
    COALESCE(jsonb_agg(DISTINCT item_id) FILTER (WHERE item_id IS NOT NULL AND full_access = false), '[]'::jsonb)
  INTO v_size_full_access, v_size_items
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'size' AND is_active = true;

  -- 4. جلب صلاحيات التصنيفات
  SELECT 
    COALESCE(bool_or(full_access), false),
    COALESCE(jsonb_agg(DISTINCT item_id) FILTER (WHERE item_id IS NOT NULL AND full_access = false), '[]'::jsonb)
  INTO v_category_full_access, v_category_items
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'category' AND is_active = true;

  -- 5. جلب صلاحيات الأقسام
  SELECT 
    COALESCE(bool_or(full_access), false),
    COALESCE(jsonb_agg(DISTINCT item_id) FILTER (WHERE item_id IS NOT NULL AND full_access = false), '[]'::jsonb)
  INTO v_department_full_access, v_department_items
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'department' AND is_active = true;

  -- 6. جلب صلاحيات المواسم
  SELECT 
    COALESCE(bool_or(full_access), false),
    COALESCE(jsonb_agg(DISTINCT item_id) FILTER (WHERE item_id IS NOT NULL AND full_access = false), '[]'::jsonb)
  INTO v_season_full_access, v_season_items
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'season' AND is_active = true;

  -- حساب الإحصائيات حسب الأقسام مع تطبيق الصلاحيات
  SELECT jsonb_agg(dept_stats)
  INTO v_departments
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'color', d.color,
      'icon', d.icon,
      'total_products', COUNT(DISTINCT p.id),
      'low_stock', COUNT(DISTINCT p.id) FILTER (WHERE COALESCE(i.quantity, 0) <= COALESCE(i.min_stock, 10) AND COALESCE(i.quantity, 0) > 0),
      'out_of_stock', COUNT(DISTINCT p.id) FILTER (WHERE COALESCE(i.quantity, 0) = 0),
      'available', COALESCE(SUM(GREATEST(i.quantity - i.reserved_quantity, 0)), 0),
      'reserved', COALESCE(SUM(i.reserved_quantity), 0),
      'total_value', COALESCE(SUM(COALESCE(pv.cost_price, p.cost_price, 0) * i.quantity), 0)
    ) as dept_stats
    FROM departments d
    LEFT JOIN product_departments pd ON d.id = pd.department_id
    LEFT JOIN products p ON pd.product_id = p.id AND p.is_active = true
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE d.is_active = true
      AND (
        v_department_full_access = true
        OR (pd.department_id::text = ANY(SELECT jsonb_array_elements_text(v_department_items)))
      )
      AND (
        v_product_full_access = true
        OR p.id IS NULL
        OR (p.id::text = ANY(SELECT jsonb_array_elements_text(v_product_items)))
      )
      AND (
        v_color_full_access = true
        OR pv.color_id IS NULL
        OR (pv.color_id::text = ANY(SELECT jsonb_array_elements_text(v_color_items)))
      )
      AND (
        v_size_full_access = true
        OR pv.size_id IS NULL
        OR (pv.size_id::text = ANY(SELECT jsonb_array_elements_text(v_size_items)))
      )
    GROUP BY d.id, d.name, d.color, d.icon, d.display_order
    ORDER BY d.display_order, d.name
  ) dept_data;

  -- حساب الإحصائيات الإجمالية مع تطبيق جميع الصلاحيات
  SELECT 
    COUNT(DISTINCT p.id),
    COUNT(DISTINCT p.id) FILTER (WHERE COALESCE(i.quantity, 0) <= COALESCE(i.min_stock, 10) AND COALESCE(i.quantity, 0) > 0),
    COUNT(DISTINCT p.id) FILTER (WHERE COALESCE(i.quantity, 0) = 0),
    COALESCE(SUM(i.reserved_quantity), 0),
    COALESCE(SUM(GREATEST(i.quantity - i.reserved_quantity, 0)), 0),
    COALESCE(SUM(COALESCE(pv.cost_price, p.cost_price, 0) * i.quantity), 0)
  INTO v_total_products, v_low_stock, v_out_of_stock, v_reserved, v_available, v_total_value
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND (
      v_product_full_access = true
      OR (p.id::text = ANY(SELECT jsonb_array_elements_text(v_product_items)))
    )
    AND (
      v_color_full_access = true
      OR pv.color_id IS NULL
      OR (pv.color_id::text = ANY(SELECT jsonb_array_elements_text(v_color_items)))
    )
    AND (
      v_size_full_access = true
      OR pv.size_id IS NULL
      OR (pv.size_id::text = ANY(SELECT jsonb_array_elements_text(v_size_items)))
    )
    AND (
      v_category_full_access = true
      OR p.category_id IS NULL
      OR (p.category_id::text = ANY(SELECT jsonb_array_elements_text(v_category_items)))
    )
    AND (
      v_department_full_access = true
      OR NOT EXISTS (SELECT 1 FROM product_departments WHERE product_id = p.id)
      OR EXISTS (
        SELECT 1 FROM product_departments pd 
        WHERE pd.product_id = p.id 
          AND pd.department_id::text = ANY(SELECT jsonb_array_elements_text(v_department_items))
      )
    )
    AND (
      v_season_full_access = true
      OR NOT EXISTS (SELECT 1 FROM product_seasons_occasions WHERE product_id = p.id)
      OR EXISTS (
        SELECT 1 FROM product_seasons_occasions pso 
        WHERE pso.product_id = p.id 
          AND pso.season_occasion_id::text = ANY(SELECT jsonb_array_elements_text(v_season_items))
      )
    );

  -- إرجاع النتائج
  RETURN jsonb_build_object(
    'total_products', COALESCE(v_total_products, 0),
    'low_stock', COALESCE(v_low_stock, 0),
    'out_of_stock', COALESCE(v_out_of_stock, 0),
    'reserved_stock', COALESCE(v_reserved, 0),
    'available_stock', COALESCE(v_available, 0),
    'total_value', COALESCE(v_total_value, 0),
    'departments', COALESCE(v_departments, '[]'::jsonb)
  );
END;
$$;