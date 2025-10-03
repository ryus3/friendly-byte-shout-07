-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

-- إنشاء الدالة الجديدة مع دعم جميع أنواع الصلاحيات
CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id uuid,
  p_filter_type text DEFAULT NULL,
  p_filter_value text DEFAULT NULL
)
RETURNS TABLE (
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
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_product_permissions uuid[];
  v_category_permissions uuid[];
  v_department_permissions uuid[];
  v_product_type_permissions uuid[];
  v_color_permissions uuid[];
  v_size_permissions uuid[];
  v_season_permissions uuid[];
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

  -- جلب صلاحيات الموظف من جميع الأنواع
  SELECT 
    COALESCE(array_agg(DISTINCT pp.product_id) FILTER (WHERE pp.product_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.category_id) FILTER (WHERE pp.category_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.department_id) FILTER (WHERE pp.department_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.product_type_id) FILTER (WHERE pp.product_type_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.color_id) FILTER (WHERE pp.color_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.size_id) FILTER (WHERE pp.size_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.season_id) FILTER (WHERE pp.season_id IS NOT NULL), ARRAY[]::uuid[])
  INTO 
    v_product_permissions,
    v_category_permissions,
    v_department_permissions,
    v_product_type_permissions,
    v_color_permissions,
    v_size_permissions,
    v_season_permissions
  FROM product_permissions pp
  WHERE pp.user_id = p_employee_id;

  -- عرض الصلاحيات في الـ logs للتشخيص
  RAISE NOTICE 'Employee ID: %, Products: %, Categories: %, Departments: %, ProductTypes: %, Colors: %, Sizes: %, Seasons: %',
    p_employee_id,
    array_length(v_product_permissions, 1),
    array_length(v_category_permissions, 1),
    array_length(v_department_permissions, 1),
    array_length(v_product_type_permissions, 1),
    array_length(v_color_permissions, 1),
    array_length(v_size_permissions, 1),
    array_length(v_season_permissions, 1);

  -- إرجاع البيانات بناءً على جميع أنواع الصلاحيات
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
    -- شروط الصلاحيات - يكفي أن تتحقق إحداها
    AND (
      -- صلاحيات المنتج المباشرة
      (array_length(v_product_permissions, 1) > 0 AND p.id = ANY(v_product_permissions))
      OR
      -- صلاحيات التصنيف
      (array_length(v_category_permissions, 1) > 0 AND p.category_id = ANY(v_category_permissions))
      OR
      -- صلاحيات القسم
      (array_length(v_department_permissions, 1) > 0 AND p.department_id = ANY(v_department_permissions))
      OR
      -- صلاحيات نوع المنتج
      (array_length(v_product_type_permissions, 1) > 0 AND p.product_type_id = ANY(v_product_type_permissions))
      OR
      -- صلاحيات الموسم
      (array_length(v_season_permissions, 1) > 0 AND p.season_id = ANY(v_season_permissions))
      OR
      -- صلاحيات الألوان
      (array_length(v_color_permissions, 1) > 0 AND pv.color_id = ANY(v_color_permissions))
      OR
      -- صلاحيات القياسات
      (array_length(v_size_permissions, 1) > 0 AND pv.size_id = ANY(v_size_permissions))
    )
    -- شروط الفلترة
    AND (p_filter_type IS NULL OR 
         (p_filter_type = 'product' AND p.id::text = p_filter_value) OR
         (p_filter_type = 'category' AND cat.name ILIKE '%' || p_filter_value || '%') OR
         (p_filter_type = 'color' AND c.name ILIKE '%' || p_filter_value || '%') OR
         (p_filter_type = 'size' AND s.name ILIKE '%' || p_filter_value || '%'))
  ORDER BY p.name, c.name, s.name;
END;
$$;