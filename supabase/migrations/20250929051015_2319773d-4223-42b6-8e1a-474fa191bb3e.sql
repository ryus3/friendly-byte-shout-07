-- تحسين دالة البحث الذكي للمناطق مع نظام مرادفات متقدم
DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, city_id_filter integer DEFAULT NULL)
RETURNS TABLE(
  region_id integer, 
  region_name text, 
  city_id integer, 
  city_name text, 
  match_type text, 
  confidence numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  normalized_search text;
  synonym_search text;
BEGIN
  normalized_search := lower(trim(search_text));
  
  -- نظام مرادفات ذكي للمناطق الشائعة
  synonym_search := CASE 
    -- مرادفات الكرادة
    WHEN normalized_search ~ 'كراد|كراده|كراد[ةه]' THEN 'كرادة'
    WHEN normalized_search ~ 'شارع فلسطين|فلسطين' THEN 'شارع فلسطين'
    WHEN normalized_search ~ 'كرادة?\s*(داخل|خارج)' THEN 
      CASE 
        WHEN normalized_search ~ 'داخل' THEN 'كرادة داخل'
        WHEN normalized_search ~ 'خارج' THEN 'كرادة خارج'
        ELSE 'كرادة'
      END
    -- مرادفات الجادرية
    WHEN normalized_search ~ 'جادري|جادريه|جادر' THEN 'الجادرية'
    WHEN normalized_search ~ 'جامعة بغداد' THEN 'الجادرية'
    -- مرادفات الكاظمية
    WHEN normalized_search ~ 'كاظمي|كاظم|كاضم' THEN 'الكاظمية'
    -- مرادفات الأعظمية
    WHEN normalized_search ~ 'اعظمي|عظمي|اعضمي' THEN 'الأعظمية'
    -- مرادفات المنصور
    WHEN normalized_search ~ 'منصور' THEN 'المنصور'
    -- مرادفات الدورة
    WHEN normalized_search ~ 'دوره|دور' THEN 'الدورة'
    -- مرادفات البياع
    WHEN normalized_search ~ 'بياع|بيع' THEN 'البياع'
    -- مرادفات الحرية
    WHEN normalized_search ~ 'حري|حريه' THEN 'الحرية'
    ELSE normalized_search
  END;
  
  RETURN QUERY
  SELECT 
    rc.id as region_id,
    rc.name as region_name,
    cc.id as city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(rc.name) = synonym_search THEN 'exact_synonym'
      WHEN lower(rc.name) = normalized_search THEN 'exact'
      WHEN lower(rc.name) LIKE synonym_search || '%' THEN 'prefix_synonym'
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 'prefix'
      WHEN lower(rc.name) LIKE '%' || synonym_search || '%' THEN 'contains_synonym'
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 'contains'
      ELSE 'fuzzy'
    END as match_type,
    CASE 
      WHEN lower(rc.name) = synonym_search THEN 1.0
      WHEN lower(rc.name) = normalized_search THEN 0.95
      WHEN lower(rc.name) LIKE synonym_search || '%' THEN 0.9
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 0.85
      WHEN lower(rc.name) LIKE '%' || synonym_search || '%' THEN 0.8
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 0.75
      WHEN similarity(lower(rc.name), synonym_search) > 0.6 THEN similarity(lower(rc.name), synonym_search)
      WHEN similarity(lower(rc.name), normalized_search) > 0.5 THEN similarity(lower(rc.name), normalized_search)
      ELSE 0.3
    END as confidence
  FROM regions_cache rc
  JOIN cities_cache cc ON rc.city_id = cc.id
  WHERE rc.is_active = true 
    AND cc.is_active = true
    AND (city_id_filter IS NULL OR cc.id = city_id_filter)
    AND (
      lower(rc.name) = synonym_search
      OR lower(rc.name) = normalized_search
      OR lower(rc.name) LIKE '%' || synonym_search || '%'
      OR lower(rc.name) LIKE '%' || normalized_search || '%'
      OR similarity(lower(rc.name), synonym_search) > 0.6
      OR similarity(lower(rc.name), normalized_search) > 0.5
    )
  ORDER BY confidence DESC, rc.name
  LIMIT 10;
END;
$$;