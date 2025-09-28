-- إصلاح دالة smart_search_region - المشكلة الحقيقية في البوت
-- حذف الدالة الخاطئة وإعادة إنشائها بشكل صحيح

DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

CREATE OR REPLACE FUNCTION public.smart_search_region(search_term text, target_city_id integer DEFAULT NULL)
RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, match_type text, confidence numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search TEXT;
BEGIN
  normalized_search := lower(trim(search_term));
  
  IF normalized_search = '' THEN
    RETURN;
  END IF;

  -- البحث المباشر في المرادفات (مع الحصول على city_id من regions_cache)
  RETURN QUERY
  SELECT 
    ra.region_id,
    r.name,
    r.city_id,  -- من regions_cache وليس من region_aliases
    c.name,
    'exact_alias'::TEXT as match_type,
    CASE 
      WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN ra.confidence_score * 1.2
      ELSE ra.confidence_score
    END
  FROM public.region_aliases ra
  JOIN public.regions_cache r ON ra.region_id = r.id
  JOIN public.cities_cache c ON r.city_id = c.id  -- الربط الصحيح عبر regions_cache
  WHERE ra.normalized_name = normalized_search
    AND r.is_active = true
    AND c.is_active = true
    AND (target_city_id IS NULL OR r.city_id = target_city_id)
  ORDER BY 
    CASE WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN 0 ELSE 1 END,
    ra.confidence_score DESC;

  -- البحث في أسماء المناطق الأصلية
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.id,
      r.name,
      r.city_id,
      c.name,
      'exact_region'::TEXT as match_type,
      CASE 
        WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN 1.2
        ELSE 1.0
      END::NUMERIC
    FROM public.regions_cache r
    JOIN public.cities_cache c ON r.city_id = c.id
    WHERE lower(r.name) = normalized_search
      AND r.is_active = true
      AND c.is_active = true
      AND (target_city_id IS NULL OR r.city_id = target_city_id)
    ORDER BY 
      CASE WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN 0 ELSE 1 END;
  END IF;

  -- البحث التقريبي
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      ra.region_id,
      r.name,
      r.city_id,  -- من regions_cache وليس من region_aliases
      c.name,
      'partial_alias'::TEXT as match_type,
      CASE 
        WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN ra.confidence_score * 0.9
        ELSE ra.confidence_score * 0.7
      END
    FROM public.region_aliases ra
    JOIN public.regions_cache r ON ra.region_id = r.id
    JOIN public.cities_cache c ON r.city_id = c.id  -- الربط الصحيح عبر regions_cache
    WHERE ra.normalized_name LIKE '%' || normalized_search || '%'
      AND r.is_active = true
      AND c.is_active = true
      AND (target_city_id IS NULL OR r.city_id = target_city_id)
    ORDER BY 
      CASE WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN 0 ELSE 1 END,
      ra.confidence_score DESC
    LIMIT 10;
  END IF;
END;
$function$;