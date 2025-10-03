-- تحديث دالة smart_search_city لاستخدام التطبيع المحسّن
CREATE OR REPLACE FUNCTION public.smart_search_city(search_text text)
RETURNS TABLE(city_id integer, city_name text, confidence numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
BEGIN
  -- تطبيع النص باستخدام المنطق المحسّن
  normalized_search := lower(trim(search_text));
  normalized_search := regexp_replace(normalized_search, '^ال', '');
  normalized_search := regexp_replace(normalized_search, '[أإآ]', 'ا', 'g');
  normalized_search := regexp_replace(normalized_search, '[ة]', 'ه', 'g');
  normalized_search := regexp_replace(normalized_search, '[ؤ]', 'و', 'g');
  normalized_search := regexp_replace(normalized_search, '[ئ]', 'ي', 'g');
  normalized_search := regexp_replace(normalized_search, '[ء]', '', 'g');
  normalized_search := regexp_replace(normalized_search, '\s+', ' ', 'g');
  
  RETURN QUERY
  SELECT 
    cc.id as city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(cc.name) = normalized_search THEN 1.0
      WHEN lower(cc.name) LIKE normalized_search || '%' THEN 0.9
      WHEN lower(cc.name) LIKE '%' || normalized_search || '%' THEN 0.8
      ELSE 0.5
    END as confidence
  FROM cities_cache cc
  WHERE cc.is_active = true
    AND (
      lower(cc.name) = normalized_search
      OR lower(cc.name) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || lower(cc.name) || '%'
    )
  ORDER BY confidence DESC, cc.name
  LIMIT 5;
END;
$function$;