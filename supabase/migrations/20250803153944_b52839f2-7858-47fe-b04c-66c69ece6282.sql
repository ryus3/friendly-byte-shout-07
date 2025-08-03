-- إنشاء دالة موحدة لبيانات الفلاتر
CREATE OR REPLACE FUNCTION public.get_filters_data()
RETURNS TABLE(
  departments JSONB,
  categories JSONB,
  colors JSONB,
  sizes JSONB,
  product_types JSONB,
  seasons_occasions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT jsonb_agg(jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'description', d.description,
      'icon', d.icon,
      'color', d.color,
      'is_active', d.is_active,
      'display_order', d.display_order
    )) FROM departments d WHERE d.is_active = true ORDER BY d.display_order, d.name) as departments,
    
    (SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'type', c.type
    )) FROM categories c ORDER BY c.name) as categories,
    
    (SELECT jsonb_agg(jsonb_build_object(
      'id', col.id,
      'name', col.name,
      'hex_code', col.hex_code
    )) FROM colors col ORDER BY col.name) as colors,
    
    (SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'type', s.type,
      'display_order', s.display_order
    )) FROM sizes s ORDER BY s.display_order, s.name) as sizes,
    
    (SELECT jsonb_agg(jsonb_build_object(
      'id', pt.id,
      'name', pt.name,
      'description', pt.description
    )) FROM product_types pt ORDER BY pt.name) as product_types,
    
    (SELECT jsonb_agg(jsonb_build_object(
      'id', so.id,
      'name', so.name,
      'type', so.type,
      'description', so.description
    )) FROM seasons_occasions so ORDER BY so.name) as seasons_occasions;
END;
$function$;