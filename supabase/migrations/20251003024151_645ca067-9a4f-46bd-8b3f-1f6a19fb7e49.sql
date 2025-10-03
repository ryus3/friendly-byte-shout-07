-- إصلاح فوري: حذف فحوصات الأعمدة غير الموجودة من get_unified_inventory_stats
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN := false;
  v_category_ids UUID[];
  v_category_full_access BOOLEAN := false;
  v_product_ids UUID[];
  v_product_full_access BOOLEAN := false;
  v_color_ids UUID[];
  v_color_full_access BOOLEAN := false;
  v_size_ids UUID[];
  v_size_full_access BOOLEAN := false;
  v_total_products INTEGER := 0;
  v_total_variants INTEGER := 0;
  v_low_stock_count INTEGER := 0;
  v_out_of_stock_count INTEGER := 0;
  v_reserved_stock_count INTEGER := 0;
  v_total_stock_value NUMERIC := 0;
BEGIN
  -- فحص صلاحيات المدير
  v_is_admin := is_admin_or_deputy();

  -- إذا لم يكن مدير، جلب الصلاحيات
  IF NOT v_is_admin THEN
    -- صلاحيات التصنيفات
    SELECT 
      COALESCE(array_agg(DISTINCT target_id::uuid) FILTER (WHERE target_id != '*'), ARRAY[]::uuid[]),
      bool_or(target_id = '*')
    INTO v_category_ids, v_category_full_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'category'
      AND is_active = true;

    -- صلاحيات المنتجات المحددة
    SELECT 
      COALESCE(array_agg(DISTINCT target_id::uuid) FILTER (WHERE target_id != '*'), ARRAY[]::uuid[]),
      bool_or(target_id = '*')
    INTO v_product_ids, v_product_full_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'product'
      AND is_active = true;

    -- صلاحيات الألوان
    SELECT 
      COALESCE(array_agg(DISTINCT target_id::uuid) FILTER (WHERE target_id != '*'), ARRAY[]::uuid[]),
      bool_or(target_id = '*')
    INTO v_color_ids, v_color_full_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'color'
      AND is_active = true;

    -- صلاحيات الأحجام
    SELECT 
      COALESCE(array_agg(DISTINCT target_id::uuid) FILTER (WHERE target_id != '*'), ARRAY[]::uuid[]),
      bool_or(target_id = '*')
    INTO v_size_ids, v_size_full_access
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'size'
      AND is_active = true;
  END IF;

  -- حساب عدد المنتجات المسموح بها
  SELECT COUNT(DISTINCT p.id)
  INTO v_total_products
  FROM products p
  WHERE p.is_active = true
    AND (
      v_is_admin = true
      OR
      (
        -- فحص التصنيف
        (v_category_full_access OR p.category_id IS NULL OR p.category_id = ANY(v_category_ids))
        AND
        -- فحص المنتج المحدد
        (v_product_full_access OR p.id = ANY(v_product_ids))
      )
    );

  -- حساب الإحصائيات من المتغيرات والمخزون
  WITH filtered_variants AS (
    SELECT 
      pv.id,
      pv.product_id,
      pv.price,
      pv.cost_price,
      i.quantity,
      i.reserved_quantity,
      i.min_stock
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND (
        v_is_admin = true
        OR
        (
          -- فحص التصنيف
          (v_category_full_access OR p.category_id IS NULL OR p.category_id = ANY(v_category_ids))
          AND
          -- فحص المنتج المحدد
          (v_product_full_access OR p.id = ANY(v_product_ids))
          AND
          -- فحص اللون
          (v_color_full_access OR pv.color_id IS NULL OR pv.color_id = ANY(v_color_ids))
          AND
          -- فحص الحجم
          (v_size_full_access OR pv.size_id IS NULL OR pv.size_id = ANY(v_size_ids))
        )
      )
  )
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN COALESCE(quantity, 0) <= COALESCE(min_stock, 0) AND COALESCE(quantity, 0) > 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(quantity, 0) = 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(reserved_quantity), 0),
    COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(cost_price, 0)), 0)
  INTO 
    v_total_variants,
    v_low_stock_count,
    v_out_of_stock_count,
    v_reserved_stock_count,
    v_total_stock_value
  FROM filtered_variants;

  -- إرجاع النتيجة كـ JSON
  RETURN jsonb_build_object(
    'totalProducts', v_total_products,
    'totalVariants', v_total_variants,
    'lowStockCount', v_low_stock_count,
    'outOfStockCount', v_out_of_stock_count,
    'reservedStockCount', v_reserved_stock_count,
    'totalStockValue', v_total_stock_value
  );
END;
$$;