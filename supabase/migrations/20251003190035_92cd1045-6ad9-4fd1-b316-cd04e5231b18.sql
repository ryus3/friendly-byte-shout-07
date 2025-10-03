-- حذف الدالة القديمة وإنشائها من جديد بالنوع الصحيح
DROP FUNCTION IF EXISTS public.get_all_inventory_simple();

CREATE FUNCTION public.get_all_inventory_simple()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  category_name text,
  color_name text,
  size_name text,
  variant_id uuid,
  price numeric,
  available_quantity bigint,
  reserved_quantity bigint,
  total_quantity bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    c.name as category_name,
    col.name as color_name,
    s.name as size_name,
    pv.id as variant_id,
    pv.price,
    COALESCE(i.quantity - i.reserved_quantity, 0)::bigint as available_quantity,
    COALESCE(i.reserved_quantity, 0)::bigint as reserved_quantity,
    COALESCE(i.quantity, 0)::bigint as total_quantity
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors col ON pv.color_id = col.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
  ORDER BY p.name, col.name, s.name;
END;
$$;