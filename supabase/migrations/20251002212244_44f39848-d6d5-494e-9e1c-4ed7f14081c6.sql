-- حذف الدالة القديمة وإعادة إنشائها بشكل صحيح تماماً
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id uuid,
  p_filter_type text DEFAULT NULL,
  p_filter_value text DEFAULT NULL
)
RETURNS TABLE (
  variant_id uuid,
  product_id uuid,
  product_name text,
  color_id uuid,
  color_name text,
  size_id uuid,
  size_name text,
  available_quantity integer,
  reserved_quantity integer,
  total_quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- فحص إذا كان المستخدم admin/deputy
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_employee_id
      AND r.name IN ('super_admin', 'admin', 'deputy')
      AND ur.is_active = true
  ) INTO v_is_admin;

  -- إذا لم يكن مدير، جلب صلاحيات المنتجات
  IF NOT v_is_admin THEN
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_product_full_access, v_product_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'product'
    LIMIT 1;

    -- جلب صلاحيات الألوان
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_color_full_access, v_color_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'color'
    LIMIT 1;

    -- جلب صلاحيات الأحجام
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
  SELECT DISTINCT
    pv.id as variant_id,
    p.id as product_id,
    p.name as product_name,
    c.id as color_id,
    c.name as color_name,
    s.id as size_id,
    s.name as size_name,
    COALESCE(i.quantity - i.reserved_quantity, 0)::integer as available_quantity,
    COALESCE(i.reserved_quantity, 0)::integer as reserved_quantity,
    COALESCE(i.quantity, 0)::integer as total_quantity
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  LEFT JOIN inventory i ON i.variant_id = pv.id
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
    )
    -- تطبيق الفلاتر
    AND (
      p_filter_type IS NULL
      OR (p_filter_type = 'product' AND p.name ILIKE '%' || p_filter_value || '%')
      OR (p_filter_type = 'color' AND c.name ILIKE '%' || p_filter_value || '%')
      OR (p_filter_type = 'size' AND s.name ILIKE '%' || p_filter_value || '%')
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;