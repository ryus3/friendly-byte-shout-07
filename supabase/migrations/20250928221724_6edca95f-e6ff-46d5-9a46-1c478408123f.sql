-- تحسين دالة فهم المناطق العراقية مع قاموس ذكي للمرادفات
DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, p_city_id integer DEFAULT NULL)
 RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, match_type text, confidence numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
  v_search_variations text[];
BEGIN
  -- تطبيع النص المدخل
  normalized_search := lower(trim(regexp_replace(search_text, E'[\\s]+', ' ', 'g')));
  
  -- إنشاء متغيرات للبحث مع المرادفات العراقية الشائعة
  v_search_variations := ARRAY[
    normalized_search,
    -- إزالة "حي" من البداية
    regexp_replace(normalized_search, '^حي\\s+', ''),
    -- إزالة "منطقة" من البداية  
    regexp_replace(normalized_search, '^منطقة\\s+', ''),
    -- إزالة "دورة" من البداية
    regexp_replace(normalized_search, '^دورة\\s+', ''),
    -- إضافة "دورة" للبحث
    'دورة ' || normalized_search,
    -- معالجة "حي الصحة" -> "دورة الصحة"
    CASE WHEN normalized_search LIKE '%حي الصحة%' THEN 'دورة الصحة'
         WHEN normalized_search LIKE '%حي %' THEN regexp_replace(normalized_search, 'حي ', 'دورة ')
         ELSE normalized_search
    END,
    -- معالجة الكرادة
    CASE WHEN normalized_search LIKE '%كرادة%' THEN 'الكرادة'
         WHEN normalized_search = 'كرادة' THEN 'الكرادة'
         ELSE normalized_search
    END
  ];
  
  RETURN QUERY
  WITH region_matches AS (
    SELECT DISTINCT
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id as city_id,
      cc.name as city_name,
      'exact' as match_type,
      1.0 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true 
      AND cc.is_active = true
      AND (p_city_id IS NULL OR rc.city_id = p_city_id)
      AND (
        lower(rc.name) = ANY(v_search_variations)
        OR lower(rc.name_ar) = ANY(v_search_variations)
      )
    
    UNION ALL
    
    -- بحث بالبداية
    SELECT DISTINCT
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id as city_id,
      cc.name as city_name,
      'starts_with' as match_type,
      0.9 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true 
      AND cc.is_active = true
      AND (p_city_id IS NULL OR rc.city_id = p_city_id)
      AND EXISTS (
        SELECT 1 FROM unnest(v_search_variations) AS var
        WHERE lower(rc.name) LIKE var || '%'
          OR lower(rc.name_ar) LIKE var || '%'
      )
    
    UNION ALL
    
    -- بحث يحتوي على
    SELECT DISTINCT
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id as city_id,
      cc.name as city_name,
      'contains' as match_type,
      0.7 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true 
      AND cc.is_active = true
      AND (p_city_id IS NULL OR rc.city_id = p_city_id)
      AND EXISTS (
        SELECT 1 FROM unnest(v_search_variations) AS var
        WHERE lower(rc.name) LIKE '%' || var || '%'
          OR lower(rc.name_ar) LIKE '%' || var || '%'
          OR var LIKE '%' || lower(rc.name) || '%'
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
  ORDER BY rm.confidence DESC, 
           CASE WHEN p_city_id IS NOT NULL AND rm.city_id = p_city_id THEN 0 ELSE 1 END,
           rm.region_name
  LIMIT 5;
END;
$function$