-- حل جذري: إرجاع الدالة لنسخة بسيطة تعمل بدون تعقيدات الصلاحيات
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats(p_employee_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_products INTEGER := 0;
  v_total_variants INTEGER := 0;
  v_low_stock_count INTEGER := 0;
  v_out_of_stock_count INTEGER := 0;
  v_reserved_stock_count INTEGER := 0;
  v_total_stock_value NUMERIC := 0;
BEGIN
  -- حساب عدد المنتجات النشطة
  SELECT COUNT(DISTINCT id)
  INTO v_total_products
  FROM products
  WHERE is_active = true;

  -- حساب إحصائيات المخزون من المتغيرات
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_stock, 0) AND COALESCE(i.quantity, 0) > 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(i.quantity, 0) = 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(i.reserved_quantity, 0)), 0),
    COALESCE(SUM(COALESCE(i.quantity, 0) * COALESCE(pv.cost_price, 0)), 0)
  INTO 
    v_total_variants,
    v_low_stock_count,
    v_out_of_stock_count,
    v_reserved_stock_count,
    v_total_stock_value
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'totalProducts', v_total_products,
    'totalVariants', v_total_variants,
    'lowStockCount', v_low_stock_count,
    'outOfStockCount', v_out_of_stock_count,
    'reservedStockCount', v_reserved_stock_count,
    'totalStockValue', v_total_stock_value
  );
END;
$$;