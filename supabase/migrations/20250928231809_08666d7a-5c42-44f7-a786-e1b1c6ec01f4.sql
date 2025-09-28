-- تحسين دالة smart_search_region لإعطاء أولوية أعلى للمناطق الشهيرة مثل الكرادة
DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, city_id_filter integer DEFAULT NULL)
RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, match_type text, confidence numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
  search_words text[];
BEGIN
  normalized_search := lower(trim(search_text));
  search_words := string_to_array(normalized_search, ' ');
  
  RETURN QUERY
  WITH region_matches AS (
    SELECT 
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id,
      cc.name as city_name,
      CASE 
        WHEN lower(rc.name) = normalized_search THEN 'exact'
        WHEN lower(rc.name) LIKE normalized_search || '%' THEN 'prefix'
        WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 'contains'
        WHEN normalized_search LIKE '%' || lower(rc.name) || '%' THEN 'reverse_contains'
        ELSE 'fuzzy'
      END as match_type,
      CASE 
        -- إعطاء أولوية عالية جداً للكرادة داخل عند البحث عن "كرادة"
        WHEN normalized_search = 'كرادة' AND lower(rc.name) = 'كرادة داخل' THEN 1.0
        WHEN normalized_search = 'الكرادة' AND lower(rc.name) = 'كرادة داخل' THEN 1.0
        -- مطابقة تامة
        WHEN lower(rc.name) = normalized_search THEN 0.95
        -- بداية الاسم - مع أولوية للمناطق الشهيرة
        WHEN lower(rc.name) LIKE normalized_search || '%' THEN 
          CASE 
            WHEN rc.name IN ('كرادة داخل', 'كرادة خارج', 'المنصور', 'الجادرية', 'الكاظمية', 'الصدر') THEN 0.9
            ELSE 0.8
          END
        -- احتواء - مع تفضيل المناطق الشهيرة
        WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 
          CASE 
            WHEN rc.name IN ('كرادة داخل', 'كرادة خارج', 'المنصور', 'الجادرية', 'الكاظمية', 'الصدر') THEN 0.75
            ELSE 0.6
          END
        -- مطابقة عكسية
        WHEN normalized_search LIKE '%' || lower(rc.name) || '%' THEN 0.5
        ELSE 0.3
      END as confidence
    FROM regions_cache rc
    LEFT JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true
      AND cc.is_active = true
      AND (city_id_filter IS NULL OR rc.city_id = city_id_filter)
      AND (
        lower(rc.name) = normalized_search
        OR lower(rc.name) LIKE '%' || normalized_search || '%'
        OR normalized_search LIKE '%' || lower(rc.name) || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(search_words) as word
          WHERE lower(rc.name) LIKE '%' || word || '%'
        )
      )
  )
  SELECT 
    rm.region_id,
    rm.region_name,
    rm.city_id,
    rm.city_name,
    rm.match_type,
    rm.confidence
  FROM region_matches rm
  ORDER BY 
    rm.confidence DESC,
    -- أولوية إضافية للمناطق الشهيرة
    CASE 
      WHEN rm.region_name IN ('كرادة داخل', 'كرادة خارج', 'المنصور', 'الجادرية') THEN 1
      ELSE 2
    END,
    rm.region_name
  LIMIT 10;
END;
$function$;