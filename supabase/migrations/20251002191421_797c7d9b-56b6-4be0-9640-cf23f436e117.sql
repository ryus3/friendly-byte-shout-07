-- ==========================================
-- إصلاح دوال الجرد الذكية
-- ==========================================

-- 1) حذف الدالة القديمة إن وجدت
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid);
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

-- 2) إنشاء الدالة الجديدة بالتوقيع الصحيح (3 معاملات)
CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id uuid,
  p_search_type text DEFAULT 'all',
  p_search_value text DEFAULT NULL
)
RETURNS TABLE(
  product_name text,
  color_name text,
  size_name text,
  total_quantity integer,
  available_quantity integer,
  reserved_quantity integer,
  department_name text,
  category_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_restrictions boolean := false;
  v_allowed_products uuid[];
  v_allowed_departments uuid[];
  v_allowed_categories uuid[];
BEGIN
  -- جلب صلاحيات الموظف
  SELECT 
    CASE 
      WHEN upp.permission_type = 'all_products' THEN false
      ELSE true
    END,
    CASE 
      WHEN upp.permission_type = 'specific_products' THEN 
        (SELECT array_agg((item->>'product_id')::uuid) 
         FROM jsonb_array_elements(upp.allowed_items) item)
      ELSE NULL
    END,
    CASE 
      WHEN upp.permission_type = 'specific_departments' THEN 
        (SELECT array_agg((item->>'department_id')::uuid) 
         FROM jsonb_array_elements(upp.allowed_items) item)
      ELSE NULL
    END,
    CASE 
      WHEN upp.permission_type = 'specific_categories' THEN 
        (SELECT array_agg((item->>'category_id')::uuid) 
         FROM jsonb_array_elements(upp.allowed_items) item)
      ELSE NULL
    END
  INTO 
    v_has_restrictions,
    v_allowed_products,
    v_allowed_departments,
    v_allowed_categories
  FROM user_product_permissions upp
  WHERE upp.user_id = p_employee_id
  LIMIT 1;

  -- إذا لم توجد صلاحيات، افترض صلاحية كاملة
  IF NOT FOUND THEN
    v_has_restrictions := false;
  END IF;

  -- بناء الاستعلام الأساسي
  RETURN QUERY
  SELECT 
    p.name as product_name,
    COALESCE(c.name, 'افتراضي') as color_name,
    COALESCE(s.name, 'افتراضي') as size_name,
    COALESCE(i.quantity, 0) as total_quantity,
    COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
    COALESCE(i.reserved_quantity, 0) as reserved_quantity,
    COALESCE(d.name, 'غير محدد') as department_name,
    COALESCE(cat.name, 'غير محدد') as category_name
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN departments d ON p.department_id = d.id
  LEFT JOIN categories cat ON p.category_id = cat.id
  WHERE p.is_active = true
    -- تطبيق الصلاحيات
    AND (
      NOT v_has_restrictions
      OR (v_allowed_products IS NOT NULL AND p.id = ANY(v_allowed_products))
      OR (v_allowed_departments IS NOT NULL AND p.department_id = ANY(v_allowed_departments))
      OR (v_allowed_categories IS NOT NULL AND p.category_id = ANY(v_allowed_categories))
    )
    -- تطبيق الفلاتر حسب نوع البحث
    AND (
      p_search_type = 'all'
      OR (p_search_type = 'product' AND LOWER(p.name) LIKE '%' || LOWER(p_search_value) || '%')
      OR (p_search_type = 'department' AND LOWER(d.name) LIKE '%' || LOWER(p_search_value) || '%')
      OR (p_search_type = 'category' AND LOWER(cat.name) LIKE '%' || LOWER(p_search_value) || '%')
      OR (p_search_type = 'color' AND LOWER(c.name) LIKE '%' || LOWER(p_search_value) || '%')
      OR (p_search_type = 'size' AND LOWER(s.name) LIKE '%' || LOWER(p_search_value) || '%')
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;