-- حذف الدالة القديمة وإعادة إنشائها بشكل صحيح
DROP FUNCTION IF EXISTS public.get_unified_inventory_stats();

CREATE OR REPLACE FUNCTION public.get_unified_inventory_stats()
RETURNS TABLE (
  total_products bigint,
  total_variants bigint,
  total_quantity bigint,
  reserved_stock_count bigint,
  low_stock_count bigint,
  out_of_stock_count bigint,
  total_inventory_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT pv.id) as total_variants,
    COALESCE(SUM(i.quantity), 0) as total_quantity,
    COALESCE(SUM(i.reserved_quantity), 0) as reserved_stock_count,
    COUNT(DISTINCT CASE 
      WHEN (i.quantity - i.reserved_quantity) > 0 
           AND (i.quantity - i.reserved_quantity) <= i.min_stock 
      THEN pv.id 
    END) as low_stock_count,
    COUNT(DISTINCT CASE 
      WHEN (i.quantity - i.reserved_quantity) <= 0 
      THEN pv.id 
    END) as out_of_stock_count,
    COALESCE(SUM(i.quantity * COALESCE(pv.price, 15000)), 0) as total_inventory_value
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true;
END;
$$;