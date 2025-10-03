-- إرجاع get_unified_inventory_stats للنسخة القديمة التي ترجع jsonb مباشرة
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_products int := 0;
  v_total_variants int := 0;
  v_high_stock_count int := 0;
  v_medium_stock_count int := 0;
  v_low_stock_count int := 0;
  v_out_of_stock_count int := 0;
  v_reserved_stock_count int := 0;
  v_archived_products_count int := 0;
  v_total_stock_value numeric := 0;
  v_departments_data jsonb := '[]'::jsonb;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT public.is_admin_or_deputy() INTO v_is_admin;
  
  -- حساب عدد المنتجات النشطة
  SELECT COUNT(DISTINCT id)
  INTO v_total_products
  FROM public.products
  WHERE is_active = true;
  
  -- حساب عدد المنتجات المؤرشفة
  SELECT COUNT(DISTINCT id)
  INTO v_archived_products_count
  FROM public.products
  WHERE is_active = false;
  
  -- حساب عدد المتغيرات والمخزون
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
  FROM public.product_variants pv
  INNER JOIN public.products p ON pv.product_id = p.id
  LEFT JOIN public.inventory i ON pv.id = i.variant_id
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
    FROM public.departments d
    LEFT JOIN public.products p ON p.department_id = d.id AND p.is_active = true
    LEFT JOIN public.product_variants pv ON pv.product_id = p.id
    LEFT JOIN public.inventory i ON i.variant_id = pv.id
    WHERE d.is_active = true
    GROUP BY d.id, d.name
  ) dept_stats;
  
  -- إرجاع النتائج كـ jsonb array مع عنصر واحد
  RETURN jsonb_build_array(
    jsonb_build_object(
      'total_products', COALESCE(v_total_products, 0),
      'total_variants', COALESCE(v_total_variants, 0),
      'high_stock_count', COALESCE(v_high_stock_count, 0),
      'medium_stock_count', COALESCE(v_medium_stock_count, 0),
      'low_stock_count', COALESCE(v_low_stock_count, 0),
      'out_of_stock_count', COALESCE(v_out_of_stock_count, 0),
      'reserved_stock_count', COALESCE(v_reserved_stock_count, 0),
      'archived_products_count', COALESCE(v_archived_products_count, 0),
      'total_inventory_value', COALESCE(v_total_stock_value, 0),
      'departments_data', v_departments_data
    )
  );
END;
$$;