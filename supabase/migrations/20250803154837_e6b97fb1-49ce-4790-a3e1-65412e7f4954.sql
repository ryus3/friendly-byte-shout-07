-- إصلاح دالة get_filters_data
DROP FUNCTION IF EXISTS public.get_filters_data();

CREATE OR REPLACE FUNCTION public.get_filters_data()
RETURNS TABLE(
  departments jsonb,
  categories jsonb,
  colors jsonb,
  sizes jsonb,
  product_types jsonb,
  seasons_occasions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    -- الأقسام
    (SELECT jsonb_agg(jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'description', d.description,
      'icon', d.icon,
      'color', d.color,
      'is_active', d.is_active,
      'display_order', d.display_order
    ) ORDER BY d.display_order, d.name) 
     FROM (SELECT * FROM departments WHERE is_active = true ORDER BY display_order, name) d) as departments,
    
    -- التصنيفات
    (SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'type', c.type
    ) ORDER BY c.name) 
     FROM (SELECT * FROM categories ORDER BY name) c) as categories,
    
    -- الألوان
    (SELECT jsonb_agg(jsonb_build_object(
      'id', col.id,
      'name', col.name,
      'hex_code', col.hex_code
    ) ORDER BY col.name) 
     FROM (SELECT * FROM colors ORDER BY name) col) as colors,
    
    -- الأحجام
    (SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'type', s.type,
      'display_order', s.display_order
    ) ORDER BY s.display_order, s.name) 
     FROM (SELECT * FROM sizes ORDER BY display_order, name) s) as sizes,
    
    -- أنواع المنتجات
    (SELECT jsonb_agg(jsonb_build_object(
      'id', pt.id,
      'name', pt.name,
      'description', pt.description
    ) ORDER BY pt.name) 
     FROM (SELECT * FROM product_types ORDER BY name) pt) as product_types,
    
    -- المواسم والمناسبات
    (SELECT jsonb_agg(jsonb_build_object(
      'id', so.id,
      'name', so.name,
      'type', so.type,
      'description', so.description
    ) ORDER BY so.name) 
     FROM (SELECT * FROM seasons_occasions ORDER BY name) so) as seasons_occasions;
END;
$function$;