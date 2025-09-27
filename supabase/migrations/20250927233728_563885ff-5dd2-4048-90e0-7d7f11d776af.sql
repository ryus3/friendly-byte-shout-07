-- حذف وإعادة إنشاء دالة البحث عن المناطق
DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, city_id_filter integer DEFAULT NULL)
 RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, match_type text, confidence numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
BEGIN
  normalized_search := lower(trim(search_text));
  
  RETURN QUERY
  SELECT 
    rc.id as region_id,
    rc.name as region_name,
    rc.city_id as city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(rc.name) = normalized_search THEN 'exact'
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 'prefix'
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 'contains'
      ELSE 'partial'
    END as match_type,
    CASE 
      WHEN lower(rc.name) = normalized_search THEN 1.0
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 0.9
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 0.8
      ELSE 0.5
    END as confidence
  FROM regions_cache rc
  JOIN cities_cache cc ON rc.city_id = cc.id
  WHERE rc.is_active = true
    AND cc.is_active = true
    AND (city_id_filter IS NULL OR rc.city_id = city_id_filter)
    AND (
      lower(rc.name) = normalized_search
      OR lower(rc.name) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || lower(rc.name) || '%'
    )
  ORDER BY confidence DESC, rc.name
  LIMIT 5;
END;
$function$;