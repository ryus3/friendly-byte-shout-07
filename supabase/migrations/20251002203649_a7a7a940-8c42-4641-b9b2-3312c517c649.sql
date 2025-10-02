-- ==========================================
-- Phase 1 & 2: إصلاح شامل لدوال الجرد الذكية
-- ==========================================

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_employee_inventory_stats(uuid);
DROP FUNCTION IF EXISTS public.smart_inventory_search(uuid, text);

-- ==========================================
-- 1. دالة get_inventory_by_permissions المحسّنة
-- ==========================================
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
    SELECT DISTINCT p.id, p.name, 
           d.name as dept_name,
           cat.name as cat_name
    FROM products p
    LEFT JOIN departments d ON p.department_id = d.id
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
        OR (p_filter_type = 'department' AND v_search_lower != '' AND LOWER(d.name) LIKE '%' || v_search_lower || '%')
        OR (p_filter_type = 'category' AND v_search_lower != '' AND LOWER(cat.name) LIKE '%' || v_search_lower || '%')
        OR (p_filter_type = 'color' AND v_search_lower != '' AND LOWER(co.name) LIKE '%' || v_search_lower || '%')
        OR (p_filter_type = 'size' AND v_search_lower != '' AND LOWER(sz.name) LIKE '%' || v_search_lower || '%')
      )
  )
  SELECT 
    fp.id as product_id,
    fp.name as product_name,
    fp.dept_name as department_name,
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
  GROUP BY fp.id, fp.name, fp.dept_name, fp.cat_name
  ORDER BY fp.name;
END;
$$;

-- ==========================================
-- 2. دالة get_employee_inventory_stats المحدّثة
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_employee_inventory_stats(
  p_employee_id uuid
)
RETURNS TABLE (
  total_products bigint,
  total_variants bigint,
  total_stock bigint,
  available_stock bigint,
  reserved_stock bigint,
  low_stock_items bigint,
  out_of_stock_items bigint,
  total_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH inventory_data AS (
    SELECT * FROM get_inventory_by_permissions(p_employee_id, NULL, NULL)
  ),
  variant_stats AS (
    SELECT 
      v->>'variant_id' as variant_id,
      (v->>'total_quantity')::integer as qty,
      (v->>'available_quantity')::integer as avail,
      (v->>'reserved_quantity')::integer as reserved
    FROM inventory_data id,
         jsonb_array_elements(id.variants) v
  )
  SELECT 
    COUNT(DISTINCT id.product_id)::bigint as total_products,
    COUNT(*)::bigint as total_variants,
    COALESCE(SUM(vs.qty), 0)::bigint as total_stock,
    COALESCE(SUM(vs.avail), 0)::bigint as available_stock,
    COALESCE(SUM(vs.reserved), 0)::bigint as reserved_stock,
    COUNT(*) FILTER (WHERE vs.avail > 0 AND vs.avail < 10)::bigint as low_stock_items,
    COUNT(*) FILTER (WHERE vs.avail = 0)::bigint as out_of_stock_items,
    COALESCE(SUM(
      pv.price * vs.avail
    ), 0)::numeric as total_value
  FROM variant_stats vs
  LEFT JOIN product_variants pv ON pv.id::text = vs.variant_id;
END;
$$;

-- ==========================================
-- 3. دالة smart_inventory_search المحدّثة
-- ==========================================
CREATE OR REPLACE FUNCTION public.smart_inventory_search(
  p_employee_id uuid,
  p_search_text text
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  department_name text,
  category_name text,
  color_name text,
  size_name text,
  total_quantity integer,
  available_quantity integer,
  reserved_quantity integer,
  match_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_lower text;
  v_words text[];
  v_word text;
BEGIN
  -- تطبيع نص البحث
  v_search_lower := LOWER(TRIM(p_search_text));
  v_words := string_to_array(v_search_lower, ' ');

  RETURN QUERY
  WITH inventory_data AS (
    SELECT * FROM get_inventory_by_permissions(p_employee_id, NULL, NULL)
  ),
  variant_details AS (
    SELECT 
      id.product_id,
      id.product_name,
      id.department_name,
      id.category_name,
      (v->>'variant_id')::uuid as variant_id,
      v->>'color_name' as color_name,
      v->>'size_name' as size_name,
      (v->>'total_quantity')::integer as total_quantity,
      (v->>'available_quantity')::integer as available_quantity,
      (v->>'reserved_quantity')::integer as reserved_quantity
    FROM inventory_data id,
         jsonb_array_elements(id.variants) v
  )
  SELECT 
    vd.product_id,
    vd.product_name,
    vd.department_name,
    vd.category_name,
    vd.color_name,
    vd.size_name,
    vd.total_quantity,
    vd.available_quantity,
    vd.reserved_quantity,
    (
      -- حساب درجة التطابق
      CASE WHEN LOWER(vd.product_name) = v_search_lower THEN 100
           WHEN LOWER(vd.product_name) LIKE v_search_lower || '%' THEN 90
           WHEN LOWER(vd.product_name) LIKE '%' || v_search_lower || '%' THEN 80
           ELSE 50
      END +
      CASE WHEN LOWER(vd.color_name) LIKE '%' || v_search_lower || '%' THEN 30 ELSE 0 END +
      CASE WHEN LOWER(vd.size_name) LIKE '%' || v_search_lower || '%' THEN 20 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(vd.department_name, '')) LIKE '%' || v_search_lower || '%' THEN 10 ELSE 0 END
    )::numeric as match_score
  FROM variant_details vd
  WHERE 
    LOWER(vd.product_name || ' ' || vd.color_name || ' ' || vd.size_name || ' ' || COALESCE(vd.department_name, '')) 
    LIKE '%' || v_search_lower || '%'
  ORDER BY match_score DESC, vd.product_name, vd.color_name, vd.size_name
  LIMIT 50;
END;
$$;