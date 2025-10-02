-- إصلاح سريع: حذف استخدام department_id غير الموجود
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id uuid,
  p_filter_type text DEFAULT NULL,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  department_name text,
  category_name text,
  variants jsonb,
  total_available integer,
  total_stock integer,
  total_reserved integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean := false;
  v_search_lower text;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_employee_id
      AND r.name IN ('admin', 'super_admin', 'deputy_admin')
      AND ur.is_active = true
  ) INTO v_is_admin;

  -- تطبيع نص البحث
  v_search_lower := LOWER(TRIM(COALESCE(p_search_term, '')));

  -- إرجاع البيانات حسب الصلاحيات والفلتر
  RETURN QUERY
  WITH filtered_products AS (
    SELECT DISTINCT 
      p.id, 
      p.name,
      cat.name as cat_name
    FROM products p
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors co ON pv.color_id = co.id
    LEFT JOIN sizes sz ON pv.size_id = sz.id
    WHERE p.is_active = true
      -- فحص الصلاحيات
      AND (
        v_is_admin = true
        OR EXISTS (
          SELECT 1 FROM product_permissions pp
          WHERE pp.product_id = p.id
            AND pp.user_id = p_employee_id
            AND pp.is_active = true
        )
      )
      -- فحص نوع الفلتر
      AND (
        p_filter_type IS NULL
        OR (p_filter_type = 'product' AND v_search_lower != '' AND LOWER(p.name) LIKE '%' || v_search_lower || '%')
        OR (p_filter_type = 'category' AND v_search_lower != '' AND LOWER(cat.name) LIKE '%' || v_search_lower || '%')
        OR (p_filter_type = 'color' AND v_search_lower != '' AND LOWER(co.name) LIKE '%' || v_search_lower || '%')
        OR (p_filter_type = 'size' AND v_search_lower != '' AND LOWER(sz.name) LIKE '%' || v_search_lower || '%')
      )
  )
  SELECT 
    fp.id as product_id,
    fp.name as product_name,
    NULL::text as department_name,
    fp.cat_name as category_name,
    jsonb_agg(
      jsonb_build_object(
        'variant_id', pv.id,
        'color_name', COALESCE(c.name, 'غير محدد'),
        'size_name', COALESCE(s.name, 'غير محدد'),
        'total_quantity', COALESCE(inv.quantity, 0),
        'available_quantity', COALESCE(inv.quantity - inv.reserved_quantity, 0),
        'reserved_quantity', COALESCE(inv.reserved_quantity, 0)
      )
      ORDER BY c.name, s.name
    ) as variants,
    SUM(COALESCE(inv.quantity - inv.reserved_quantity, 0))::integer as total_available,
    SUM(COALESCE(inv.quantity, 0))::integer as total_stock,
    SUM(COALESCE(inv.reserved_quantity, 0))::integer as total_reserved
  FROM filtered_products fp
  JOIN product_variants pv ON fp.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory inv ON pv.id = inv.variant_id
  GROUP BY fp.id, fp.name, fp.cat_name
  ORDER BY fp.name;
END;
$$;