-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

-- إنشاء دالة البحث الذكي المحسنة عن المناطق
CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, p_city_id integer DEFAULT NULL)
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
    rc.city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(rc.name) = normalized_search THEN 'exact_match'
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 'starts_with'
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 'contains'
      ELSE 'partial'
    END as match_type,
    CASE 
      -- تطابق دقيق يحصل على نقاط أعلى
      WHEN lower(rc.name) = normalized_search THEN 1.0
      -- البحث عن "دوره" - إعطاء أولوية عالية للمناطق التي تحتوي على دوره في بداية الاسم
      WHEN normalized_search = 'دوره' AND lower(rc.name) LIKE 'الدوره%' THEN 0.95
      WHEN normalized_search = 'دوره' AND lower(rc.name) LIKE '%دوره%' THEN 0.9
      -- تطابق في بداية الاسم
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 0.85
      -- تطابق جزئي مع أولوية للمدينة المحددة
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' AND (p_city_id IS NULL OR rc.city_id = p_city_id) THEN 0.8
      -- تطابق جزئي عام
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 0.6
      ELSE 0.5
    END as confidence
  FROM regions_cache rc
  JOIN cities_cache cc ON rc.city_id = cc.id
  WHERE rc.is_active = true
    AND cc.is_active = true
    AND (
      lower(rc.name) = normalized_search
      OR lower(rc.name) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || lower(rc.name) || '%'
    )
    AND (p_city_id IS NULL OR rc.city_id = p_city_id)
  ORDER BY 
    -- ترتيب أولوي: المدينة المحددة أولاً، ثم الثقة، ثم الاسم
    CASE WHEN p_city_id IS NOT NULL AND rc.city_id = p_city_id THEN 1 ELSE 2 END,
    confidence DESC,
    rc.name
  LIMIT 10;
END;
$function$;