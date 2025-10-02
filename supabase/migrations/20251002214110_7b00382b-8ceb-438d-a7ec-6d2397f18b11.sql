-- إصلاح جذري: توحيد اسم معامل البحث في smart_inventory_search
-- المشكلة: الدالة تستخدم p_search_query بينما Edge Function يستدعيها بـ p_search_text

-- حذف النسخة القديمة
DROP FUNCTION IF EXISTS public.smart_inventory_search(UUID, TEXT);

-- إنشاء النسخة الصحيحة مع المعامل الموحد p_search_text
CREATE OR REPLACE FUNCTION public.smart_inventory_search(
  p_employee_id UUID,
  p_search_text TEXT  -- ← المعامل الموحد الصحيح
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  color_id UUID,
  color_name TEXT,
  size_id UUID,
  size_name TEXT,
  variant_id UUID,
  available_quantity INTEGER,
  reserved_quantity INTEGER,
  price NUMERIC,
  cost_price NUMERIC,
  barcode TEXT,
  image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_permissions TEXT[];
  v_department_ids UUID[];
  v_normalized_search TEXT;
BEGIN
  -- التحقق من صلاحيات المستخدم
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  -- جمع الصلاحيات
  SELECT array_agg(p.name) INTO v_permissions
  FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id
  JOIN user_roles ur ON rp.role_id = ur.role_id
  WHERE ur.user_id = p_employee_id AND ur.is_active = true;
  
  -- جمع الأقسام المصرح بها للموظف
  IF NOT v_is_admin AND NOT ('view_all_inventory' = ANY(v_permissions)) THEN
    SELECT array_agg(DISTINCT department_id) INTO v_department_ids
    FROM employee_department_permissions
    WHERE user_id = p_employee_id AND is_active = true;
  END IF;
  
  -- تطبيع نص البحث
  v_normalized_search := LOWER(TRIM(COALESCE(p_search_text, '')));
  
  RETURN QUERY
  SELECT DISTINCT
    p.id AS product_id,
    p.name AS product_name,
    c.id AS color_id,
    c.name AS color_name,
    s.id AS size_id,
    s.name AS size_name,
    pv.id AS variant_id,
    COALESCE(i.quantity - i.reserved_quantity, 0)::INTEGER AS available_quantity,
    COALESCE(i.reserved_quantity, 0)::INTEGER AS reserved_quantity,
    pv.price,
    COALESCE(pv.cost_price, p.cost_price, 0) AS cost_price,
    pv.barcode,
    p.image_url
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND (
      v_is_admin 
      OR 'view_all_inventory' = ANY(v_permissions)
      OR p.department_id = ANY(v_department_ids)
    )
    AND (
      v_normalized_search = '' 
      OR LOWER(p.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(c.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(s.name) LIKE '%' || v_normalized_search || '%'
      OR LOWER(pv.barcode) LIKE '%' || v_normalized_search || '%'
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;