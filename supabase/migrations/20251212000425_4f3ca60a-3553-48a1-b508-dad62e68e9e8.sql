-- تحديث دالة get_inventory_operations_log مع فلاتر متقدمة
DROP FUNCTION IF EXISTS get_inventory_operations_log(integer, uuid, text);

CREATE OR REPLACE FUNCTION get_inventory_operations_log(
  p_limit integer DEFAULT 100,
  p_product_id uuid DEFAULT NULL,
  p_operation_type text DEFAULT NULL,
  p_color_name text DEFAULT NULL,
  p_size_value text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  product_name text,
  color_name text,
  size_value text,
  operation_type text,
  quantity_change integer,
  quantity_before integer,
  quantity_after integer,
  reserved_before integer,
  reserved_after integer,
  sold_before integer,
  sold_after integer,
  source_type text,
  order_id uuid,
  tracking_number text,
  performed_by uuid,
  performed_by_name text,
  notes text,
  performed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.product_name,
    l.color_name,
    l.size_value,
    l.operation_type,
    l.quantity_change,
    l.quantity_before,
    l.quantity_after,
    l.reserved_before,
    l.reserved_after,
    l.sold_before,
    l.sold_after,
    l.source_type,
    l.order_id,
    COALESCE(l.tracking_number, o.tracking_number) as tracking_number,
    l.performed_by,
    COALESCE(p.full_name, p.business_page_name) as performed_by_name,
    l.notes,
    l.performed_at
  FROM inventory_operations_log l
  LEFT JOIN orders o ON l.order_id = o.id
  LEFT JOIN profiles p ON l.performed_by = p.user_id
  WHERE (p_product_id IS NULL OR l.product_id = p_product_id)
    AND (p_operation_type IS NULL OR l.operation_type = p_operation_type)
    AND (p_color_name IS NULL OR l.color_name = p_color_name)
    AND (p_size_value IS NULL OR l.size_value = p_size_value)
    AND (p_date_from IS NULL OR l.performed_at >= p_date_from)
    AND (p_date_to IS NULL OR l.performed_at <= p_date_to)
  ORDER BY l.performed_at DESC
  LIMIT p_limit;
END;
$$;

-- دالة لجلب الألوان والقياسات المتاحة في السجل
CREATE OR REPLACE FUNCTION get_log_filter_options()
RETURNS TABLE (
  colors text[],
  sizes text[],
  products jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT array_agg(DISTINCT l.color_name ORDER BY l.color_name) FROM inventory_operations_log l WHERE l.color_name IS NOT NULL) as colors,
    (SELECT array_agg(DISTINCT l.size_value ORDER BY l.size_value) FROM inventory_operations_log l WHERE l.size_value IS NOT NULL) as sizes,
    (SELECT jsonb_agg(DISTINCT jsonb_build_object('id', pr.id, 'name', pr.name)) 
     FROM inventory_operations_log l 
     JOIN products pr ON l.product_id = pr.id) as products;
END;
$$;