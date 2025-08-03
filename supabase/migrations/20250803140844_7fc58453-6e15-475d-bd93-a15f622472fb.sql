-- إنشاء نظام توحيدي للمرشحات لتقليل التكرار والأخطاء

-- دالة للحصول على بيانات المرشحات الأساسية
CREATE OR REPLACE FUNCTION public.get_filters_data()
RETURNS TABLE(
  departments jsonb,
  categories jsonb,
  colors jsonb,
  sizes jsonb,
  product_types jsonb,
  seasons_occasions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    -- الأقسام النشطة مرتبة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'description', d.description,
          'icon', d.icon,
          'color', d.color,
          'display_order', d.display_order
        ) ORDER BY d.display_order, d.name
      )
      FROM departments d 
      WHERE d.is_active = true
    ) as departments,
    
    -- التصنيفات النشطة مرتبة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'type', c.type
        ) ORDER BY c.name
      )
      FROM categories c
    ) as categories,
    
    -- الألوان مرتبة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', co.id,
          'name', co.name,
          'hex_code', co.hex_code
        ) ORDER BY co.name
      )
      FROM colors co
    ) as colors,
    
    -- الأحجام مرتبة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'type', s.type,
          'display_order', s.display_order
        ) ORDER BY s.display_order, s.name
      )
      FROM sizes s
    ) as sizes,
    
    -- أنواع المنتجات مرتبة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pt.id,
          'name', pt.name,
          'description', pt.description
        ) ORDER BY pt.name
      )
      FROM product_types pt
    ) as product_types,
    
    -- المواسم والمناسبات مرتبة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', so.id,
          'name', so.name,
          'type', so.type,
          'description', so.description
        ) ORDER BY so.type, so.name
      )
      FROM seasons_occasions so
    ) as seasons_occasions;
END;
$function$;

-- دالة للحصول على المرشحات المسموحة حسب صلاحيات المستخدم
CREATE OR REPLACE FUNCTION public.get_user_allowed_filters(p_user_id uuid)
RETURNS TABLE(
  allowed_departments jsonb,
  allowed_categories jsonb,
  allowed_products jsonb,
  has_full_access boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile record;
  is_admin_user boolean := false;
BEGIN
  -- فحص إذا كان المستخدم مدير
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id 
    AND r.name IN ('admin', 'super_admin')
    AND ur.is_active = true
  ) INTO is_admin_user;
  
  -- إذا كان مدير، إرجاع جميع البيانات
  IF is_admin_user THEN
    RETURN QUERY
    SELECT 
      (SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name)) FROM departments d WHERE d.is_active = true),
      (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)) FROM categories c),
      (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) FROM products p WHERE p.is_active = true),
      true;
    RETURN;
  END IF;
  
  -- للموظفين: جلب الصلاحيات من جدول employee_product_permissions
  RETURN QUERY
  WITH user_permissions AS (
    SELECT 
      department_permissions,
      category_permissions,
      product_permissions
    FROM employee_product_permissions epp
    WHERE epp.user_id = p_user_id
  )
  SELECT 
    -- الأقسام المسموحة
    CASE 
      WHEN up.department_permissions ? 'all' THEN 
        (SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name)) FROM departments d WHERE d.is_active = true)
      ELSE 
        (SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name)) 
         FROM departments d 
         WHERE d.is_active = true 
         AND d.id::text = ANY(SELECT jsonb_array_elements_text(up.department_permissions)))
    END as allowed_departments,
    
    -- التصنيفات المسموحة
    CASE 
      WHEN up.category_permissions ? 'all' THEN 
        (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)) FROM categories c)
      ELSE 
        (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)) 
         FROM categories c 
         WHERE c.id::text = ANY(SELECT jsonb_array_elements_text(up.category_permissions)))
    END as allowed_categories,
    
    -- المنتجات المسموحة
    CASE 
      WHEN up.product_permissions ? 'all' THEN 
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) FROM products p WHERE p.is_active = true)
      ELSE 
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) 
         FROM products p 
         WHERE p.is_active = true 
         AND p.id::text = ANY(SELECT jsonb_array_elements_text(up.product_permissions)))
    END as allowed_products,
    
    false as has_full_access
  FROM user_permissions up;
END;
$function$;