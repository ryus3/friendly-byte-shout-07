-- تحديث دالة get_unified_inventory_stats لتتبع صلاحيات الموظف
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats();

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
  v_allowed_departments uuid[];
  v_allowed_categories uuid[];
  v_allowed_types uuid[];
  v_allowed_seasons uuid[];
  v_allowed_colors uuid[];
  v_allowed_sizes uuid[];
BEGIN
  -- التحقق من صلاحيات الموظف
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  -- إذا لم يكن admin، نجلب الصلاحيات
  IF NOT v_is_admin AND p_employee_id IS NOT NULL THEN
    -- جلب الصلاحيات من user_permissions
    SELECT 
      COALESCE(ARRAY_AGG(DISTINCT department_id) FILTER (WHERE department_id IS NOT NULL), ARRAY[]::uuid[]),
      COALESCE(ARRAY_AGG(DISTINCT category_id) FILTER (WHERE category_id IS NOT NULL), ARRAY[]::uuid[]),
      COALESCE(ARRAY_AGG(DISTINCT product_type_id) FILTER (WHERE product_type_id IS NOT NULL), ARRAY[]::uuid[]),
      COALESCE(ARRAY_AGG(DISTINCT season_occasion_id) FILTER (WHERE season_occasion_id IS NOT NULL), ARRAY[]::uuid[]),
      COALESCE(ARRAY_AGG(DISTINCT color_id) FILTER (WHERE color_id IS NOT NULL), ARRAY[]::uuid[]),
      COALESCE(ARRAY_AGG(DISTINCT size_id) FILTER (WHERE size_id IS NOT NULL), ARRAY[]::uuid[])
    INTO 
      v_allowed_departments,
      v_allowed_categories,
      v_allowed_types,
      v_allowed_seasons,
      v_allowed_colors,
      v_allowed_sizes
    FROM user_permissions
    WHERE user_id = p_employee_id;
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
      AND (v_is_admin OR p_employee_id IS NULL OR pd.department_id = ANY(v_allowed_departments))
    GROUP BY pd.department_id
  ) dept_products ON d.id = dept_products.department_id
  WHERE d.is_active = true
    AND (v_is_admin OR p_employee_id IS NULL OR d.id = ANY(v_allowed_departments));

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
      -- فلترة حسب الصلاحيات
      AND (
        v_is_admin OR p_employee_id IS NULL
        OR (
          -- الأقسام
          (CARDINALITY(v_allowed_departments) = 0 OR EXISTS (
            SELECT 1 FROM product_departments pd 
            WHERE pd.product_id = p.id AND pd.department_id = ANY(v_allowed_departments)
          ))
          -- التصنيفات
          AND (CARDINALITY(v_allowed_categories) = 0 OR p.category_id = ANY(v_allowed_categories))
          -- الأنواع
          AND (CARDINALITY(v_allowed_types) = 0 OR p.product_type_id = ANY(v_allowed_types))
          -- المواسم
          AND (CARDINALITY(v_allowed_seasons) = 0 OR p.season_occasion_id = ANY(v_allowed_seasons))
          -- الألوان
          AND (CARDINALITY(v_allowed_colors) = 0 OR pv.color_id = ANY(v_allowed_colors))
          -- القياسات
          AND (CARDINALITY(v_allowed_sizes) = 0 OR pv.size_id = ANY(v_allowed_sizes))
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
      -- المنتجات المؤرشفة (التي جميع مقاساتها نافذة)
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
      -- قيمة المخزون الإجمالية
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