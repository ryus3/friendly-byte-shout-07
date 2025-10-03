-- إرجاع get_unified_inventory_stats لترجع TABLE بدلاً من jsonb
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id UUID)
RETURNS TABLE (
  total_products INTEGER,
  total_variants INTEGER,
  high_stock_count INTEGER,
  medium_stock_count INTEGER,
  low_stock_count INTEGER,
  out_of_stock_count INTEGER,
  reserved_stock_count INTEGER,
  archived_products_count INTEGER,
  total_inventory_value NUMERIC,
  departments_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_products INTEGER := 0;
  v_total_variants INTEGER := 0;
  v_high_stock_count INTEGER := 0;
  v_medium_stock_count INTEGER := 0;
  v_low_stock_count INTEGER := 0;
  v_out_of_stock_count INTEGER := 0;
  v_reserved_stock_count INTEGER := 0;
  v_archived_products_count INTEGER := 0;
  v_total_stock_value NUMERIC := 0;
  v_departments_data JSONB := '[]'::jsonb;
BEGIN
  -- حساب عدد المنتجات النشطة
  SELECT COUNT(DISTINCT id)
  INTO v_total_products
  FROM products
  WHERE is_active = true;

  -- حساب عدد المنتجات المؤرشفة
  SELECT COUNT(DISTINCT id)
  INTO v_archived_products_count
  FROM products
  WHERE is_active = false;

  -- حساب إحصائيات المخزون من المتغيرات
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE 
      WHEN COALESCE(i.quantity, 0) > COALESCE(i.min_stock, 0) * 2 THEN 1 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN COALESCE(i.quantity, 0) > COALESCE(i.min_stock, 0) 
        AND COALESCE(i.quantity, 0) <= COALESCE(i.min_stock, 0) * 2 THEN 1 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_stock, 0) 
        AND COALESCE(i.quantity, 0) > 0 THEN 1 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(i.quantity, 0) = 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(i.reserved_quantity, 0)), 0),
    COALESCE(SUM(COALESCE(i.quantity, 0) * COALESCE(pv.cost_price, 0)), 0)
  INTO 
    v_total_variants,
    v_high_stock_count,
    v_medium_stock_count,
    v_low_stock_count,
    v_out_of_stock_count,
    v_reserved_stock_count,
    v_total_stock_value
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true;

  -- حساب بيانات الأقسام
  SELECT COALESCE(jsonb_agg(dept_stats), '[]'::jsonb)
  INTO v_departments_data
  FROM (
    SELECT 
      d.id,
      d.name,
      COUNT(DISTINCT p.id) as product_count,
      COALESCE(SUM(i.quantity), 0) as total_quantity
    FROM departments d
    LEFT JOIN products p ON p.department_id = d.id AND p.is_active = true
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN inventory i ON i.variant_id = pv.id
    WHERE d.is_active = true
    GROUP BY d.id, d.name
  ) dept_stats;

  -- إرجاع النتيجة كصف واحد
  RETURN QUERY SELECT 
    v_total_products,
    v_total_variants,
    v_high_stock_count,
    v_medium_stock_count,
    v_low_stock_count,
    v_out_of_stock_count,
    v_reserved_stock_count,
    v_archived_products_count,
    v_total_stock_value,
    v_departments_data;
END;
$$;