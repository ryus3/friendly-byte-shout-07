-- إصلاح خطأ p.price في دالة get_unified_inventory_stats
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_products INTEGER := 0;
  v_total_variants INTEGER := 0;
  v_high_stock INTEGER := 0;
  v_medium_stock INTEGER := 0;
  v_low_stock INTEGER := 0;
  v_out_of_stock INTEGER := 0;
  v_reserved_stock INTEGER := 0;
  v_archived_products INTEGER := 0;
  v_total_inventory_value NUMERIC := 0;
  v_departments_data JSONB := '[]'::jsonb;
BEGIN
  -- إجمالي المنتجات النشطة
  SELECT COUNT(DISTINCT p.id) INTO v_total_products
  FROM products p
  WHERE p.is_active = true
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- إجمالي المتغيرات
  SELECT COUNT(pv.id) INTO v_total_variants
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.is_active = true
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- المنتجات ذات المخزون العالي (أكثر من 50)
  SELECT COUNT(DISTINCT p.id) INTO v_high_stock
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND COALESCE(i.quantity, 0) > 50
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- المنتجات ذات المخزون المتوسط (11-50)
  SELECT COUNT(DISTINCT p.id) INTO v_medium_stock
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND COALESCE(i.quantity, 0) BETWEEN 11 AND 50
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- المنتجات ذات المخزون المنخفض (1-10)
  SELECT COUNT(DISTINCT p.id) INTO v_low_stock
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND COALESCE(i.quantity, 0) BETWEEN 1 AND 10
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- المنتجات النافدة
  SELECT COUNT(DISTINCT p.id) INTO v_out_of_stock
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND COALESCE(i.quantity, 0) = 0
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- المخزون المحجوز
  SELECT COALESCE(SUM(i.reserved_quantity), 0) INTO v_reserved_stock
  FROM inventory i
  JOIN product_variants pv ON i.variant_id = pv.id
  JOIN products p ON pv.product_id = p.id
  WHERE p.is_active = true
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- المنتجات المؤرشفة
  SELECT COUNT(*) INTO v_archived_products
  FROM products p
  WHERE p.is_active = false
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- قيمة المخزون الإجمالية - استخدام pv.price فقط
  SELECT COALESCE(SUM(
    COALESCE(i.quantity, 0) * COALESCE(pv.price, 0)
  ), 0) INTO v_total_inventory_value
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND (p_employee_id IS NULL OR p.created_by = p_employee_id);

  -- إرجاع النتائج كـ array من عنصر واحد
  RETURN jsonb_build_array(
    jsonb_build_object(
      'total_products', v_total_products,
      'total_variants', v_total_variants,
      'high_stock_count', v_high_stock,
      'medium_stock_count', v_medium_stock,
      'low_stock_count', v_low_stock,
      'out_of_stock_count', v_out_of_stock,
      'reserved_stock_count', v_reserved_stock,
      'archived_products_count', v_archived_products,
      'total_inventory_value', v_total_inventory_value,
      'departments_data', v_departments_data
    )
  );
END;
$function$;