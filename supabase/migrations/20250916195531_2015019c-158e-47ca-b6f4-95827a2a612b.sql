-- إضافة دالة لتحليل العنوان باستخدام cache
CREATE OR REPLACE FUNCTION public.parse_address_using_cache(p_address_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_city_id integer;
  v_region_id integer;
  v_city_name text;
  v_region_name text;
  v_address_lower text;
  v_city_record record;
  v_region_record record;
BEGIN
  -- تطبيع النص للبحث
  v_address_lower := lower(trim(p_address_text));
  
  -- البحث عن المدينة في cache
  FOR v_city_record IN 
    SELECT alwaseet_id, name, name_ar 
    FROM public.cities_cache 
    WHERE is_active = true
    ORDER BY length(name) DESC -- البحث عن المطابقات الطويلة أولاً
  LOOP
    IF v_address_lower LIKE '%' || lower(v_city_record.name) || '%' 
       OR v_address_lower LIKE '%' || lower(v_city_record.name_ar) || '%' THEN
      v_city_id := v_city_record.alwaseet_id;
      v_city_name := v_city_record.name;
      EXIT; -- توقف عند أول مطابقة
    END IF;
  END LOOP;
  
  -- إذا وُجدت مدينة، ابحث عن المنطقة
  IF v_city_id IS NOT NULL THEN
    FOR v_region_record IN 
      SELECT alwaseet_id, name, name_ar 
      FROM public.regions_cache 
      WHERE city_id = v_city_id AND is_active = true
      ORDER BY length(name) DESC -- البحث عن المطابقات الطويلة أولاً
    LOOP
      IF v_address_lower LIKE '%' || lower(v_region_record.name) || '%' 
         OR v_address_lower LIKE '%' || lower(v_region_record.name_ar) || '%' THEN
        v_region_id := v_region_record.alwaseet_id;
        v_region_name := v_region_record.name;
        EXIT; -- توقف عند أول مطابقة
      END IF;
    END LOOP;
  END IF;
  
  -- إرجاع النتائج
  RETURN jsonb_build_object(
    'city_id', v_city_id,
    'region_id', v_region_id,
    'city_name', v_city_name,
    'region_name', v_region_name,
    'found_city', v_city_id IS NOT NULL,
    'found_region', v_region_id IS NOT NULL
  );
END;
$function$;