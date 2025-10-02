-- حذف الدالة القديمة الخاطئة
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

-- إنشاء الدالة المصححة باستخدام الـ JOINs الصحيحة
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
  quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  department_name text,
  category_name text,
  product_type_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_has_all_products boolean;
  v_dept_ids uuid[];
  v_cat_ids uuid[];
  v_type_ids uuid[];
BEGIN
  -- التحقق من صلاحيات المستخدم
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  SELECT check_user_permission(p_employee_id, 'view_all_products') INTO v_has_all_products;
  
  -- إذا كان مدير أو لديه صلاحية رؤية كل المنتجات
  IF v_is_admin OR v_has_all_products THEN
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      pv.id as variant_id,
      COALESCE(c.name, 'افتراضي') as color_name,
      COALESCE(s.name, 'افتراضي') as size_name,
      COALESCE(i.quantity, 0) as quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
      COALESCE(d.name, 'غير محدد') as department_name,
      COALESCE(cat.name, 'غير محدد') as category_name,
      COALESCE(pt.name, 'غير محدد') as product_type_name
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN product_departments pd ON p.id = pd.product_id
    LEFT JOIN departments d ON pd.department_id = d.id
    LEFT JOIN product_categories pc ON p.id = pc.product_id
    LEFT JOIN categories cat ON pc.category_id = cat.id
    LEFT JOIN product_product_types ppt ON p.id = ppt.product_id
    LEFT JOIN product_types pt ON ppt.product_type_id = pt.id
    WHERE p.is_active = true
      AND (p_filter_type IS NULL OR 
           (p_filter_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
           (p_filter_type = 'department' AND LOWER(d.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
           (p_filter_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
           (p_filter_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
           (p_filter_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
           (p_filter_type = 'product_type' AND LOWER(pt.name) LIKE '%' || LOWER(p_filter_value) || '%'))
    ORDER BY p.name, c.name, s.name;
    RETURN;
  END IF;
  
  -- جلب صلاحيات الموظف المحددة
  SELECT 
    COALESCE(array_agg(DISTINCT pp.department_id) FILTER (WHERE pp.department_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.category_id) FILTER (WHERE pp.category_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT pp.product_type_id) FILTER (WHERE pp.product_type_id IS NOT NULL), ARRAY[]::uuid[])
  INTO v_dept_ids, v_cat_ids, v_type_ids
  FROM product_permissions pp
  WHERE pp.user_id = p_employee_id AND pp.can_view = true;
  
  -- إرجاع المنتجات حسب الصلاحيات
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    pv.id as variant_id,
    COALESCE(c.name, 'افتراضي') as color_name,
    COALESCE(s.name, 'افتراضي') as size_name,
    COALESCE(i.quantity, 0) as quantity,
    COALESCE(i.reserved_quantity, 0) as reserved_quantity,
    COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
    COALESCE(d.name, 'غير محدد') as department_name,
    COALESCE(cat.name, 'غير محدد') as category_name,
    COALESCE(pt.name, 'غير محدد') as product_type_name
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN product_departments pd ON p.id = pd.product_id
  LEFT JOIN departments d ON pd.department_id = d.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN categories cat ON pc.category_id = cat.id
  LEFT JOIN product_product_types ppt ON p.id = ppt.product_id
  LEFT JOIN product_types pt ON ppt.product_type_id = pt.id
  WHERE p.is_active = true
    AND (
      (array_length(v_dept_ids, 1) > 0 AND pd.department_id = ANY(v_dept_ids)) OR
      (array_length(v_cat_ids, 1) > 0 AND pc.category_id = ANY(v_cat_ids)) OR
      (array_length(v_type_ids, 1) > 0 AND ppt.product_type_id = ANY(v_type_ids))
    )
    AND (p_filter_type IS NULL OR 
         (p_filter_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
         (p_filter_type = 'department' AND LOWER(d.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
         (p_filter_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
         (p_filter_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
         (p_filter_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
         (p_filter_type = 'product_type' AND LOWER(pt.name) LIKE '%' || LOWER(p_filter_value) || '%'))
  ORDER BY p.name, c.name, s.name;
END;
$$;