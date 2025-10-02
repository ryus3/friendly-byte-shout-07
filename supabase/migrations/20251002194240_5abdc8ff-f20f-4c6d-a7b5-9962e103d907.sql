-- إزالة الدالة القديمة المعطوبة
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

-- إنشاء الدالة الجديدة بشكل صحيح تماماً
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
  quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  sold_quantity integer,
  department_name text,
  category_name text,
  product_type_name text,
  cost_price numeric,
  sale_price numeric,
  barcode text,
  location text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_view_all boolean := false;
  v_has_specific_permission boolean := false;
  v_permission_type text;
  v_allowed_items text[];
BEGIN
  -- التحقق من صلاحية "عرض كل المنتجات"
  SELECT EXISTS(
    SELECT 1 
    FROM user_product_permissions upp
    WHERE upp.user_id = p_employee_id
      AND upp.permission_type = 'view_all_products'
      AND upp.is_active = true
  ) INTO v_has_view_all;

  -- إذا كان لديه صلاحية عرض الكل، لا نحتاج لفحص الصلاحيات الأخرى
  IF v_has_view_all THEN
    RAISE NOTICE 'المستخدم لديه صلاحية عرض كل المنتجات';
    
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
      COALESCE(i.sold_quantity, 0) as sold_quantity,
      COALESCE(d.name, 'غير محدد') as department_name,
      COALESCE(cat.name, 'غير محدد') as category_name,
      COALESCE(pt.name, 'غير محدد') as product_type_name,
      COALESCE(pv.cost_price, p.cost_price, 0) as cost_price,
      COALESCE(pv.price, 15000) as sale_price,
      pv.barcode,
      i.location
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    LEFT JOIN product_departments pd ON p.id = pd.product_id
    LEFT JOIN departments d ON pd.department_id = d.id
    LEFT JOIN product_categories pc ON p.id = pc.product_id
    LEFT JOIN categories cat ON pc.category_id = cat.id
    LEFT JOIN product_product_types ppt ON p.id = ppt.product_id
    LEFT JOIN product_types pt ON ppt.product_type_id = pt.id
    WHERE p.is_active = true
      AND (p_filter_type IS NULL OR (
        (p_filter_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'department' AND LOWER(d.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
        (p_filter_type = 'smart' AND (
          LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
          LOWER(d.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
          LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
          LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
          LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%'
        ))
      ))
    ORDER BY p.name, c.name, s.name;
    
    RETURN;
  END IF;

  -- فحص الصلاحيات المحددة
  RAISE NOTICE 'فحص الصلاحيات المحددة للمستخدم: %', p_employee_id;

  -- الحصول على نوع الصلاحية والعناصر المسموحة
  SELECT upp.permission_type, upp.allowed_items
  INTO v_permission_type, v_allowed_items
  FROM user_product_permissions upp
  WHERE upp.user_id = p_employee_id
    AND upp.is_active = true
    AND upp.permission_type != 'view_all_products'
  LIMIT 1;

  IF v_permission_type IS NULL THEN
    RAISE NOTICE 'لا توجد صلاحيات محددة للمستخدم';
    RETURN;
  END IF;

  RAISE NOTICE 'نوع الصلاحية: %, العناصر المسموحة: %', v_permission_type, v_allowed_items;

  -- بناء الاستعلام بناءً على نوع الصلاحية
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
    COALESCE(i.sold_quantity, 0) as sold_quantity,
    COALESCE(d.name, 'غير محدد') as department_name,
    COALESCE(cat.name, 'غير محدد') as category_name,
    COALESCE(pt.name, 'غير محدد') as product_type_name,
    COALESCE(pv.cost_price, p.cost_price, 0) as cost_price,
    COALESCE(pv.price, 15000) as sale_price,
    pv.barcode,
    i.location
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  LEFT JOIN product_departments pd ON p.id = pd.product_id
  LEFT JOIN departments d ON pd.department_id = d.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN categories cat ON pc.category_id = cat.id
  LEFT JOIN product_product_types ppt ON p.id = ppt.product_id
  LEFT JOIN product_types pt ON ppt.product_type_id = pt.id
  WHERE p.is_active = true
    AND (
      -- صلاحيات منتجات محددة
      (v_permission_type = 'specific_products' AND p.id::text = ANY(v_allowed_items)) OR
      -- صلاحيات أقسام محددة
      (v_permission_type = 'specific_departments' AND pd.department_id::text = ANY(v_allowed_items)) OR
      -- صلاحيات فئات محددة
      (v_permission_type = 'specific_categories' AND pc.category_id::text = ANY(v_allowed_items)) OR
      -- صلاحيات أنواع منتجات محددة
      (v_permission_type = 'specific_product_types' AND ppt.product_type_id::text = ANY(v_allowed_items))
    )
    AND (p_filter_type IS NULL OR (
      (p_filter_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'department' AND LOWER(d.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%') OR
      (p_filter_type = 'smart' AND (
        LOWER(p.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
        LOWER(d.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
        LOWER(cat.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
        LOWER(c.name) LIKE '%' || LOWER(p_filter_value) || '%' OR
        LOWER(s.name) LIKE '%' || LOWER(p_filter_value) || '%'
      ))
    ))
  ORDER BY p.name, c.name, s.name;
END;
$$;