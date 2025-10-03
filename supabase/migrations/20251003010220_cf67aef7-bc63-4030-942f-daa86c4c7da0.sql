-- إصلاح دالة get_unified_inventory_stats لاستخدام user_product_permissions بدلاً من user_permissions
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id uuid DEFAULT NULL)
RETURNS TABLE(
  total_products bigint,
  total_variants bigint,
  total_quantity numeric,
  high_stock_count bigint,
  medium_stock_count bigint,
  low_stock_count bigint,
  out_of_stock_count bigint,
  reserved_stock_count bigint,
  archived_products_count bigint,
  total_inventory_value numeric,
  departments_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  dept_data jsonb;
  v_is_admin boolean;
  v_product_full_access boolean := false;
  v_product_items jsonb := '[]'::jsonb;
  v_color_full_access boolean := false;
  v_color_items jsonb := '[]'::jsonb;
  v_size_full_access boolean := false;
  v_size_items jsonb := '[]'::jsonb;
  v_category_full_access boolean := false;
  v_category_items jsonb := '[]'::jsonb;
  v_department_full_access boolean := false;
  v_department_items jsonb := '[]'::jsonb;
  v_season_full_access boolean := false;
  v_season_items jsonb := '[]'::jsonb;
BEGIN
  -- فحص إذا كان المستخدم admin/deputy
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_employee_id
      AND r.name IN ('super_admin', 'admin', 'deputy')
      AND ur.is_active = true
  ) INTO v_is_admin;

  -- إذا لم يكن مدير، جلب الصلاحيات من user_product_permissions
  IF NOT v_is_admin AND p_employee_id IS NOT NULL THEN
    -- جلب صلاحيات المنتجات
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_product_full_access, v_product_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'product'
    LIMIT 1;

    -- جلب صلاحيات الألوان
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_color_full_access, v_color_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'color'
    LIMIT 1;

    -- جلب صلاحيات الأحجام
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_size_full_access, v_size_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'size'
    LIMIT 1;

    -- جلب صلاحيات التصنيفات
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_category_full_access, v_category_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'category'
    LIMIT 1;

    -- جلب صلاحيات الأقسام
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_department_full_access, v_department_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'department'
    LIMIT 1;

    -- جلب صلاحيات المواسم
    SELECT 
      COALESCE(has_full_access, false),
      COALESCE(allowed_items, '[]'::jsonb)
    INTO v_season_full_access, v_season_items
    FROM user_product_permissions
    WHERE user_id = p_employee_id 
      AND permission_type = 'season'
    LIMIT 1;
  END IF;

  -- جلب بيانات الأقسام مع عدد المنتجات (حسب الصلاحيات)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'description', d.description,
      'icon', d.icon,
      'color', d.color,
      'display_order', d.display_order,
      'product_count', COALESCE(dept_products.product_count, 0)
    ) ORDER BY d.display_order, d.name
  ) INTO dept_data
  FROM departments d
  LEFT JOIN (
    SELECT 
      pd.department_id,
      COUNT(DISTINCT pd.product_id) as product_count
    FROM product_departments pd
    JOIN products p ON pd.product_id = p.id
    WHERE p.is_active = true
      AND (
        v_is_admin 
        OR p_employee_id IS NULL 
        OR v_department_full_access
        OR (pd.department_id::text = ANY(SELECT jsonb_array_elements_text(v_department_items)))
      )
    GROUP BY pd.department_id
  ) dept_products ON d.id = dept_products.department_id
  WHERE d.is_active = true
    AND (
      v_is_admin 
      OR p_employee_id IS NULL 
      OR v_department_full_access
      OR (d.id::text = ANY(SELECT jsonb_array_elements_text(v_department_items)))
    );

  RETURN QUERY
  WITH filtered_inventory AS (
    SELECT 
      i.id,
      i.product_id,
      i.variant_id,
      i.quantity,
      i.reserved_quantity,
      pv.cost_price,
      p.is_active
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN product_variants pv ON i.variant_id = pv.id
    WHERE p.is_active = true
      AND (
        v_is_admin 
        OR p_employee_id IS NULL
        OR (
          -- فحص صلاحيات المنتج
          (
            v_product_full_access = true
            OR (p.id::text = ANY(SELECT jsonb_array_elements_text(v_product_items)))
          )
          AND
          -- فحص صلاحيات اللون
          (
            v_color_full_access = true
            OR pv.color_id IS NULL
            OR (pv.color_id::text = ANY(SELECT jsonb_array_elements_text(v_color_items)))
          )
          AND
          -- فحص صلاحيات الحجم
          (
            v_size_full_access = true
            OR pv.size_id IS NULL
            OR (pv.size_id::text = ANY(SELECT jsonb_array_elements_text(v_size_items)))
          )
          AND
          -- فحص صلاحيات التصنيف
          (
            v_category_full_access = true
            OR p.category_id IS NULL
            OR (p.category_id::text = ANY(SELECT jsonb_array_elements_text(v_category_items)))
          )
          AND
          -- فحص صلاحيات القسم
          (
            v_department_full_access = true
            OR NOT EXISTS (SELECT 1 FROM product_departments WHERE product_id = p.id)
            OR EXISTS (
              SELECT 1 FROM product_departments pd 
              WHERE pd.product_id = p.id 
                AND pd.department_id::text = ANY(SELECT jsonb_array_elements_text(v_department_items))
            )
          )
          AND
          -- فحص صلاحيات الموسم
          (
            v_season_full_access = true
            OR p.season_occasion_id IS NULL
            OR (p.season_occasion_id::text = ANY(SELECT jsonb_array_elements_text(v_season_items)))
          )
        )
      )
  ),
  inventory_stats AS (
    SELECT 
      COUNT(DISTINCT product_id) as total_products,
      COUNT(DISTINCT variant_id) as total_variants,
      COALESCE(SUM(quantity), 0) as total_quantity,
      SUM(CASE WHEN quantity >= 10 THEN 1 ELSE 0 END) as high_stock_count,
      SUM(CASE WHEN quantity >= 5 AND quantity < 10 THEN 1 ELSE 0 END) as medium_stock_count,
      SUM(CASE WHEN quantity > 0 AND quantity < 5 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
      COALESCE(SUM(reserved_quantity), 0) as reserved_stock_count,
      COUNT(DISTINCT CASE 
        WHEN product_id IN (
          SELECT DISTINCT product_id 
          FROM filtered_inventory i2 
          WHERE i2.product_id = filtered_inventory.product_id 
          GROUP BY product_id 
          HAVING SUM(i2.quantity) = 0
        ) THEN product_id 
        ELSE NULL 
      END) as archived_products_count,
      COALESCE(SUM(quantity * cost_price), 0) as total_inventory_value
    FROM filtered_inventory
  )
  SELECT 
    is_data.total_products,
    is_data.total_variants,
    is_data.total_quantity,
    is_data.high_stock_count,
    is_data.medium_stock_count,
    is_data.low_stock_count,
    is_data.out_of_stock_count,
    is_data.reserved_stock_count,
    is_data.archived_products_count,
    is_data.total_inventory_value,
    dept_data as departments_data
  FROM inventory_stats is_data;
END;
$function$;