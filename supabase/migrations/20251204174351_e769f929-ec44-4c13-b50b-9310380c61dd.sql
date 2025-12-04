
-- حذف الدالة القديمة ثم إعادة إنشائها بالبيانات الجديدة
DROP FUNCTION IF EXISTS public.get_inventory_operations_log(integer, uuid, text);

CREATE OR REPLACE FUNCTION public.get_inventory_operations_log(
  p_limit integer DEFAULT 100, 
  p_product_id uuid DEFAULT NULL::uuid, 
  p_operation_type text DEFAULT NULL::text
)
RETURNS TABLE(
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
  performed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  ORDER BY l.performed_at DESC
  LIMIT p_limit;
END;
$function$;
