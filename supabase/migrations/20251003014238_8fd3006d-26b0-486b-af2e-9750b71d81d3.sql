-- إصلاح نهائي لدالة get_unified_inventory_stats
-- استخدام الجداول الوسيطة الصحيحة بدلاً من الأعمدة المباشرة

DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_full_product_access boolean := false;
  v_allowed_product_ids jsonb := '[]'::jsonb;
  
  v_has_full_color_access boolean := false;
  v_allowed_color_ids jsonb := '[]'::jsonb;
  
  v_has_full_size_access boolean := false;
  v_allowed_size_ids jsonb := '[]'::jsonb;
  
  v_has_full_category_access boolean := false;
  v_allowed_category_ids jsonb := '[]'::jsonb;
  
  v_has_full_department_access boolean := false;
  v_allowed_department_ids jsonb := '[]'::jsonb;
  
  v_has_full_season_access boolean := false;
  v_allowed_season_ids jsonb := '[]'::jsonb;
  
  v_total_products integer := 0;
  v_available_stock integer := 0;
  v_reserved_stock integer := 0;
  v_low_stock_count integer := 0;
  v_out_of_stock_count integer := 0;
BEGIN
  -- جلب صلاحيات المنتجات
  SELECT bool_or(has_full_access) INTO v_has_full_product_access
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'product';
  
  IF NOT COALESCE(v_has_full_product_access, false) THEN
    SELECT COALESCE(jsonb_agg(DISTINCT elem::text::uuid), '[]'::jsonb) INTO v_allowed_product_ids
    FROM user_product_permissions,
    LATERAL jsonb_array_elements_text(allowed_items) as elem
    WHERE user_id = p_user_id 
      AND permission_type = 'product'
      AND allowed_items IS NOT NULL
      AND jsonb_array_length(allowed_items) > 0;
  END IF;

  -- جلب صلاحيات الألوان
  SELECT bool_or(has_full_access) INTO v_has_full_color_access
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'color';
  
  IF NOT COALESCE(v_has_full_color_access, false) THEN
    SELECT COALESCE(jsonb_agg(DISTINCT elem::text::uuid), '[]'::jsonb) INTO v_allowed_color_ids
    FROM user_product_permissions,
    LATERAL jsonb_array_elements_text(allowed_items) as elem
    WHERE user_id = p_user_id 
      AND permission_type = 'color'
      AND allowed_items IS NOT NULL
      AND jsonb_array_length(allowed_items) > 0;
  END IF;

  -- جلب صلاحيات الأحجام
  SELECT bool_or(has_full_access) INTO v_has_full_size_access
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'size';
  
  IF NOT COALESCE(v_has_full_size_access, false) THEN
    SELECT COALESCE(jsonb_agg(DISTINCT elem::text::uuid), '[]'::jsonb) INTO v_allowed_size_ids
    FROM user_product_permissions,
    LATERAL jsonb_array_elements_text(allowed_items) as elem
    WHERE user_id = p_user_id 
      AND permission_type = 'size'
      AND allowed_items IS NOT NULL
      AND jsonb_array_length(allowed_items) > 0;
  END IF;

  -- جلب صلاحيات التصنيفات
  SELECT bool_or(has_full_access) INTO v_has_full_category_access
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'category';
  
  IF NOT COALESCE(v_has_full_category_access, false) THEN
    SELECT COALESCE(jsonb_agg(DISTINCT elem::text::uuid), '[]'::jsonb) INTO v_allowed_category_ids
    FROM user_product_permissions,
    LATERAL jsonb_array_elements_text(allowed_items) as elem
    WHERE user_id = p_user_id 
      AND permission_type = 'category'
      AND allowed_items IS NOT NULL
      AND jsonb_array_length(allowed_items) > 0;
  END IF;

  -- جلب صلاحيات الأقسام
  SELECT bool_or(has_full_access) INTO v_has_full_department_access
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'department';
  
  IF NOT COALESCE(v_has_full_department_access, false) THEN
    SELECT COALESCE(jsonb_agg(DISTINCT elem::text::uuid), '[]'::jsonb) INTO v_allowed_department_ids
    FROM user_product_permissions,
    LATERAL jsonb_array_elements_text(allowed_items) as elem
    WHERE user_id = p_user_id 
      AND permission_type = 'department'
      AND allowed_items IS NOT NULL
      AND jsonb_array_length(allowed_items) > 0;
  END IF;

  -- جلب صلاحيات المواسم
  SELECT bool_or(has_full_access) INTO v_has_full_season_access
  FROM user_product_permissions
  WHERE user_id = p_user_id AND permission_type = 'season';
  
  IF NOT COALESCE(v_has_full_season_access, false) THEN
    SELECT COALESCE(jsonb_agg(DISTINCT elem::text::uuid), '[]'::jsonb) INTO v_allowed_season_ids
    FROM user_product_permissions,
    LATERAL jsonb_array_elements_text(allowed_items) as elem
    WHERE user_id = p_user_id 
      AND permission_type = 'season'
      AND allowed_items IS NOT NULL
      AND jsonb_array_length(allowed_items) > 0;
  END IF;

  -- حساب إحصائيات المخزون مع تطبيق الصلاحيات
  SELECT 
    COUNT(DISTINCT p.id),
    COALESCE(SUM(i.quantity - i.reserved_quantity), 0),
    COALESCE(SUM(i.reserved_quantity), 0),
    COUNT(DISTINCT CASE WHEN (i.quantity - i.reserved_quantity) > 0 AND (i.quantity - i.reserved_quantity) <= i.min_stock THEN p.id END),
    COUNT(DISTINCT CASE WHEN (i.quantity - i.reserved_quantity) = 0 THEN p.id END)
  INTO 
    v_total_products,
    v_available_stock,
    v_reserved_stock,
    v_low_stock_count,
    v_out_of_stock_count
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    -- فلترة المنتجات
    AND (v_has_full_product_access OR v_allowed_product_ids ? p.id::text)
    -- فلترة التصنيفات
    AND (v_has_full_category_access OR p.category_id IS NULL OR v_allowed_category_ids ? p.category_id::text)
    -- فلترة الأقسام (استخدام الجدول الوسيط)
    AND (
      v_has_full_department_access 
      OR NOT EXISTS (SELECT 1 FROM product_departments WHERE product_id = p.id)
      OR EXISTS (
        SELECT 1 FROM product_departments pd 
        WHERE pd.product_id = p.id 
          AND v_allowed_department_ids ? pd.department_id::text
      )
    )
    -- فلترة المواسم (استخدام الجدول الوسيط)
    AND (
      v_has_full_season_access 
      OR NOT EXISTS (SELECT 1 FROM product_seasons_occasions WHERE product_id = p.id)
      OR EXISTS (
        SELECT 1 FROM product_seasons_occasions pso 
        WHERE pso.product_id = p.id 
          AND v_allowed_season_ids ? pso.season_occasion_id::text
      )
    )
    -- فلترة الألوان
    AND (v_has_full_color_access OR pv.color_id IS NULL OR v_allowed_color_ids ? pv.color_id::text)
    -- فلترة الأحجام
    AND (v_has_full_size_access OR pv.size_id IS NULL OR v_allowed_size_ids ? pv.size_id::text);

  RETURN jsonb_build_object(
    'total_products', v_total_products,
    'available_stock', v_available_stock,
    'reserved_stock', v_reserved_stock,
    'low_stock_count', v_low_stock_count,
    'out_of_stock_count', v_out_of_stock_count
  );
END;
$$;