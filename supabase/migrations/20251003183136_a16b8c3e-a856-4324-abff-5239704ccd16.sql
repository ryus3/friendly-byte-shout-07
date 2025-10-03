-- إنشاء دالة مبسطة لجرد المنتجات (تُرجع كل المنتجات للموظفين)
CREATE OR REPLACE FUNCTION get_all_inventory_simple()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  category_name text,
  color_name text,
  color_hex text,
  size_name text,
  variant_id uuid,
  total_quantity bigint,
  reserved_quantity bigint,
  available_quantity bigint,
  base_price numeric,
  cost_price numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    COALESCE(c.name, 'غير محدد') as category_name,
    COALESCE(col.name, 'افتراضي') as color_name,
    col.hex_code as color_hex,
    COALESCE(s.name, 'افتراضي') as size_name,
    pv.id as variant_id,
    COALESCE(i.quantity, 0) as total_quantity,
    COALESCE(i.reserved_quantity, 0) as reserved_quantity,
    COALESCE(i.quantity - i.reserved_quantity, 0) as available_quantity,
    COALESCE(pv.price, p.base_price, 0) as base_price,
    COALESCE(pv.cost_price, p.cost_price, 0) as cost_price
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