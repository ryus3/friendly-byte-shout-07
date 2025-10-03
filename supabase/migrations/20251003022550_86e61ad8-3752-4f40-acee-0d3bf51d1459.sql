-- تعديل الدالة لإضافة نظام الصلاحيات
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats();

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(
  p_employee_id UUID  -- معرف الموظف للتحقق من الصلاحيات
)
RETURNS TABLE (
  total_products bigint,
  total_variants bigint,
  total_quantity bigint,
  reserved_stock_count bigint,
  low_stock_count bigint,
  out_of_stock_count bigint,
  total_inventory_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_product_full_access boolean := false;
  v_product_items jsonb := '[]'::jsonb;
  v_color_full_access boolean := false;
  v_color_items jsonb := '[]'::jsonb;
  v_size_full_access boolean := false;
  v_size_items jsonb := '[]'::jsonb;
BEGIN
  -- التحقق من صلاحيات المستخدم
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_employee_id
      AND r.name IN ('super_admin', 'admin', 'deputy')
      AND ur.is_active = true
  ) INTO v_is_admin;

  -- إذا لم يكن مدير، جلب صلاحيات المنتجات
  IF NOT v_is_admin THEN
    -- صلاحيات المنتجات
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_product_full_access, v_product_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'product'
    LIMIT 1;

    -- صلاحيات الألوان
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_color_full_access, v_color_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'color'
    LIMIT 1;

    -- صلاحيات الأحجام
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_size_full_access, v_size_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'size'
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT pv.id) as total_variants,
    COALESCE(SUM(i.quantity), 0) as total_quantity,
    COALESCE(SUM(i.reserved_quantity), 0) as reserved_stock_count,
    COUNT(DISTINCT CASE 
      WHEN (i.quantity - i.reserved_quantity) > 0 
           AND (i.quantity - i.reserved_quantity) <= i.min_stock 
      THEN pv.id 
    END) as low_stock_count,
    COUNT(DISTINCT CASE 
      WHEN (i.quantity - i.reserved_quantity) <= 0 
      THEN pv.id 
    END) as out_of_stock_count,
    COALESCE(SUM(i.quantity * COALESCE(pv.price, 15000)), 0) as total_inventory_value
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND (
      -- المديرون يرون كل شيء
      v_is_admin = true
      OR
      -- الموظفون يرون حسب الصلاحيات
      (
        -- فحص صلاحيات المنتج
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
    );
END;
$$;