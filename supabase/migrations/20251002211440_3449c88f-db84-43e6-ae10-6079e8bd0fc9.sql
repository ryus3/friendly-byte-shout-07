
-- حذف وإعادة إنشاء get_inventory_by_permissions بشكل صحيح
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
  v_user_permissions jsonb;
BEGIN
  -- فحص إذا كان المستخدم admin/deputy بناءً على p_employee_id بدلاً من auth.uid()
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_employee_id
      AND r.name IN ('super_admin', 'admin', 'deputy')
      AND ur.is_active = true
  ) INTO v_is_admin;

  -- جلب صلاحيات المستخدم
  SELECT permissions INTO v_user_permissions
  FROM user_product_permissions
  WHERE user_id = p_employee_id;

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
        v_user_permissions IS NULL
        OR
        (
          -- فحص صلاحيات المنتج
          (v_user_permissions->'product'->>'has_full_access')::boolean = true
          OR
          (p.id::text = ANY(
            SELECT jsonb_array_elements_text(v_user_permissions->'product'->'allowed_items')
          ))
        )
        AND
        -- فحص صلاحيات اللون
        (
          (v_user_permissions->'color'->>'has_full_access')::boolean = true
          OR pv.color_id IS NULL
          OR (pv.color_id::text = ANY(
            SELECT jsonb_array_elements_text(v_user_permissions->'color'->'allowed_items')
          ))
        )
        AND
        -- فحص صلاحيات الحجم
        (
          (v_user_permissions->'size'->>'has_full_access')::boolean = true
          OR pv.size_id IS NULL
          OR (pv.size_id::text = ANY(
            SELECT jsonb_array_elements_text(v_user_permissions->'size'->'allowed_items')
          ))
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
