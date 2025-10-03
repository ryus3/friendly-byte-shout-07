-- إعادة كتابة دالة get_inventory_by_permissions لتستخدم user_product_permissions
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id uuid,
  p_filter_type text DEFAULT NULL,
  p_filter_value text DEFAULT NULL
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  variant_id uuid,
  color_name text,
  size_name text,
  category_name text,
  quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  total_quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  IF v_is_admin THEN
    -- المدير يرى كل شيء
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      pv.id as variant_id,
      c.name as color_name,
      s.name as size_name,
      cat.name as category_name,
      COALESCE(i.quantity, 0)::integer as quantity,
      COALESCE(i.reserved_quantity, 0)::integer as reserved_quantity,
      (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))::integer as available_quantity,
      COALESCE(i.quantity, 0)::integer as total_quantity
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND (p_filter_type IS NULL OR 
           (p_filter_type = 'product' AND p.id::text = p_filter_value) OR
           (p_filter_type = 'category' AND cat.name ILIKE '%' || p_filter_value || '%') OR
           (p_filter_type = 'color' AND c.name ILIKE '%' || p_filter_value || '%') OR
           (p_filter_type = 'size' AND s.name ILIKE '%' || p_filter_value || '%'))
    ORDER BY p.name, c.name, s.name;
    RETURN;
  END IF;

  -- للموظفين: استخدام user_product_permissions
  RETURN QUERY
  SELECT DISTINCT
    p.id as product_id,
    p.name as product_name,
    pv.id as variant_id,
    c.name as color_name,
    s.name as size_name,
    cat.name as category_name,
    COALESCE(i.quantity, 0)::integer as quantity,
    COALESCE(i.reserved_quantity, 0)::integer as reserved_quantity,
    (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))::integer as available_quantity,
    COALESCE(i.quantity, 0)::integer as total_quantity
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN categories cat ON p.category_id = cat.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND EXISTS (
      SELECT 1 FROM user_product_permissions upp
      WHERE upp.user_id = p_employee_id
      AND upp.is_active = true
      AND (
        -- صلاحية كاملة
        upp.has_full_access = true
        OR
        -- صلاحيات حسب النوع
        (upp.permission_type = 'product' AND p.id = ANY(upp.allowed_items::uuid[]))
        OR
        (upp.permission_type = 'category' AND p.category_id = ANY(upp.allowed_items::uuid[]))
        OR
        (upp.permission_type = 'department' AND p.department_id = ANY(upp.allowed_items::uuid[]))
        OR
        (upp.permission_type = 'product_type' AND p.product_type_id = ANY(upp.allowed_items::uuid[]))
        OR
        (upp.permission_type = 'season' AND p.season_id = ANY(upp.allowed_items::uuid[]))
        OR
        (upp.permission_type = 'color' AND pv.color_id = ANY(upp.allowed_items::uuid[]))
        OR
        (upp.permission_type = 'size' AND pv.size_id = ANY(upp.allowed_items::uuid[]))
      )
    )
    AND (p_filter_type IS NULL OR 
         (p_filter_type = 'product' AND p.id::text = p_filter_value) OR
         (p_filter_type = 'category' AND cat.name ILIKE '%' || p_filter_value || '%') OR
         (p_filter_type = 'color' AND c.name ILIKE '%' || p_filter_value || '%') OR
         (p_filter_type = 'size' AND s.name ILIKE '%' || p_filter_value || '%'))
  ORDER BY p.name, c.name, s.name;
END;
$$;