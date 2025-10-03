-- إصلاح دالة get_unified_inventory_stats لتفحص جميع أنواع الصلاحيات
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_products int := 0;
  v_total_variants int := 0;
  v_low_stock_count int := 0;
  v_out_of_stock_count int := 0;
  v_reserved_stock_count int := 0;
  v_total_stock_value numeric := 0;
  
  -- صلاحيات التصنيفات
  v_category_full_access boolean := false;
  v_category_items jsonb := '[]'::jsonb;
  
  -- صلاحيات الأقسام
  v_department_full_access boolean := false;
  v_department_items jsonb := '[]'::jsonb;
  
  -- صلاحيات أنواع المنتجات
  v_product_type_full_access boolean := false;
  v_product_type_items jsonb := '[]'::jsonb;
  
  -- صلاحيات المواسم/المناسبات
  v_season_full_access boolean := false;
  v_season_items jsonb := '[]'::jsonb;
  
  -- صلاحيات المنتجات المحددة
  v_product_full_access boolean := false;
  v_product_items jsonb := '[]'::jsonb;
  
  -- صلاحيات الألوان
  v_color_full_access boolean := false;
  v_color_items jsonb := '[]'::jsonb;
  
  -- صلاحيات الأحجام
  v_size_full_access boolean := false;
  v_size_items jsonb := '[]'::jsonb;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT public.is_admin_or_deputy() INTO v_is_admin;
  
  -- إذا لم يكن مدير، جلب الصلاحيات
  IF NOT v_is_admin THEN
    -- جلب صلاحيات التصنيفات
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_category_full_access, v_category_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'category'
    LIMIT 1;
    
    -- جلب صلاحيات الأقسام
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_department_full_access, v_department_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'department'
    LIMIT 1;
    
    -- جلب صلاحيات أنواع المنتجات
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_product_type_full_access, v_product_type_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'product_type'
    LIMIT 1;
    
    -- جلب صلاحيات المواسم/المناسبات
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_season_full_access, v_season_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'season_occasion'
    LIMIT 1;
    
    -- جلب صلاحيات المنتجات المحددة
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_product_full_access, v_product_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'product'
    LIMIT 1;
    
    -- جلب صلاحيات الألوان
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_color_full_access, v_color_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'color'
    LIMIT 1;
    
    -- جلب صلاحيات الأحجام
    SELECT COALESCE(has_full_access, false), COALESCE(allowed_items, '[]'::jsonb)
    INTO v_size_full_access, v_size_items
    FROM public.user_product_permissions
    WHERE user_id = COALESCE(p_employee_id, auth.uid()) 
      AND permission_type = 'size'
    LIMIT 1;
  END IF;
  
  -- حساب عدد المنتجات
  SELECT COUNT(DISTINCT p.id)
  INTO v_total_products
  FROM public.products p
  WHERE p.is_active = true
    AND (
      v_is_admin = true
      OR
      (
        -- فحص صلاحيات التصنيف
        (
          v_category_full_access = true
          OR p.category_id IS NULL
          OR (p.category_id::text = ANY(SELECT jsonb_array_elements_text(v_category_items)))
        )
        AND
        -- فحص صلاحيات القسم
        (
          v_department_full_access = true
          OR p.department_id IS NULL
          OR (p.department_id::text = ANY(SELECT jsonb_array_elements_text(v_department_items)))
        )
        AND
        -- فحص صلاحيات نوع المنتج
        (
          v_product_type_full_access = true
          OR p.product_type_id IS NULL
          OR (p.product_type_id::text = ANY(SELECT jsonb_array_elements_text(v_product_type_items)))
        )
        AND
        -- فحص صلاحيات الموسم/المناسبة
        (
          v_season_full_access = true
          OR p.season_occasion_id IS NULL
          OR (p.season_occasion_id::text = ANY(SELECT jsonb_array_elements_text(v_season_items)))
        )
        AND
        -- فحص صلاحيات المنتج المحدد
        (
          v_product_full_access = true
          OR (p.id::text = ANY(SELECT jsonb_array_elements_text(v_product_items)))
        )
      )
    );
  
  -- حساب عدد المتغيرات والمخزون
  WITH filtered_variants AS (
    SELECT 
      pv.id,
      pv.product_id,
      pv.color_id,
      pv.size_id,
      pv.cost_price,
      COALESCE(i.quantity, 0) as quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.low_stock_threshold, 10) as low_stock_threshold
    FROM public.product_variants pv
    LEFT JOIN public.inventory i ON pv.id = i.variant_id
    INNER JOIN public.products p ON pv.product_id = p.id
    WHERE p.is_active = true
      AND (
        v_is_admin = true
        OR
        (
          -- فحص صلاحيات التصنيف
          (
            v_category_full_access = true
            OR p.category_id IS NULL
            OR (p.category_id::text = ANY(SELECT jsonb_array_elements_text(v_category_items)))
          )
          AND
          -- فحص صلاحيات القسم
          (
            v_department_full_access = true
            OR p.department_id IS NULL
            OR (p.department_id::text = ANY(SELECT jsonb_array_elements_text(v_department_items)))
          )
          AND
          -- فحص صلاحيات نوع المنتج
          (
            v_product_type_full_access = true
            OR p.product_type_id IS NULL
            OR (p.product_type_id::text = ANY(SELECT jsonb_array_elements_text(v_product_type_items)))
          )
          AND
          -- فحص صلاحيات الموسم/المناسبة
          (
            v_season_full_access = true
            OR p.season_occasion_id IS NULL
            OR (p.season_occasion_id::text = ANY(SELECT jsonb_array_elements_text(v_season_items)))
          )
          AND
          -- فحص صلاحيات المنتج المحدد
          (
            v_product_full_access = true
            OR (p.id::text = ANY(SELECT jsonb_array_elements_text(v_product_items)))
          )
          AND
          -- فحص صلاحيات اللون
          (
            v_color_full_access = true
            OR pv.color_id IS NULL
            OR (pv.color_id::text = ANY(SELECT jsonb_array_elements_text(v_color_items)))
          )
          AND
          -- فحص صلاحيات الحجم
          (
            v_size_full_access = true
            OR pv.size_id IS NULL
            OR (pv.size_id::text = ANY(SELECT jsonb_array_elements_text(v_size_items)))
          )
        )
      )
  )
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN quantity > 0 AND quantity <= low_stock_threshold THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(reserved_quantity), 0),
    COALESCE(SUM(quantity * cost_price), 0)
  INTO 
    v_total_variants,
    v_low_stock_count,
    v_out_of_stock_count,
    v_reserved_stock_count,
    v_total_stock_value
  FROM filtered_variants;
  
  -- إرجاع النتائج
  RETURN jsonb_build_object(
    'totalProducts', COALESCE(v_total_products, 0),
    'totalVariants', COALESCE(v_total_variants, 0),
    'lowStockCount', COALESCE(v_low_stock_count, 0),
    'outOfStockCount', COALESCE(v_out_of_stock_count, 0),
    'reservedStockCount', COALESCE(v_reserved_stock_count, 0),
    'totalStockValue', COALESCE(v_total_stock_value, 0)
  );
END;
$$;