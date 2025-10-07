-- تحديث دالة smart_search_city لتشمل مرادفات المدن من city_aliases
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
  normalized_search := regexp_replace(normalized_search, '[أإآ]', 'a', 'g');
  normalized_search := regexp_replace(normalized_search, '[ة]', 'ه', 'g');
  normalized_search := regexp_replace(normalized_search, '[ؤ]', 'و', 'g');
  normalized_search := regexp_replace(normalized_search, '[ئ]', 'ي', 'g');
  normalized_search := regexp_replace(normalized_search, '[ء]', '', 'g');
  normalized_search := regexp_replace(normalized_search, '\s+', ' ', 'g');
  
  RETURN QUERY
  -- البحث في cities_cache (الأسماء الرسمية)
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
  
  UNION ALL
  
  -- البحث في city_aliases (المرادفات)
  SELECT 
    ca.city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(ca.alias_name) = normalized_search THEN ca.confidence_score
      WHEN lower(ca.normalized_name) = normalized_search THEN ca.confidence_score
      WHEN lower(ca.alias_name) LIKE normalized_search || '%' THEN ca.confidence_score * 0.9
      WHEN lower(ca.normalized_name) LIKE normalized_search || '%' THEN ca.confidence_score * 0.9
      ELSE ca.confidence_score * 0.7
    END as confidence
  FROM city_aliases ca
  JOIN cities_cache cc ON ca.city_id = cc.id
  WHERE cc.is_active = true
    AND ca.confidence_score >= 0.7
    AND (
      lower(ca.alias_name) = normalized_search
      OR lower(ca.normalized_name) = normalized_search
      OR lower(ca.alias_name) LIKE '%' || normalized_search || '%'
      OR lower(ca.normalized_name) LIKE '%' || normalized_search || '%'
    )
  
  ORDER BY confidence DESC, city_name
  LIMIT 5;
END;
$function$;