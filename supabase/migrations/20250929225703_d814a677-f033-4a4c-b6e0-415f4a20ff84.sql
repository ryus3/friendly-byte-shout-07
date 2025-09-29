-- تحسين دالة extract_actual_address لفلترة أرقام الهاتف وأسماء المنتجات بشكل أفضل
CREATE OR REPLACE FUNCTION public.extract_actual_address(p_original_text text, p_city_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_normalized_text text;
  v_words text[];
  v_city_found boolean := false;
  v_region_found boolean := false;
  v_remaining_text text := '';
  v_word text;
  v_found_city text;
  v_found_region text;
  v_address_parts text[] := '{}';
  v_current_index integer := 1;
BEGIN
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(p_original_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المدينة أولاً
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث عن المدينة
    IF NOT v_city_found AND length(v_word) >= 2 THEN
      SELECT cc.name INTO v_found_city
      FROM cities_cache cc 
      WHERE cc.is_active = true 
        AND (lower(cc.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(cc.name) || '%')
      ORDER BY 
        CASE WHEN lower(cc.name) = v_word THEN 1
             WHEN lower(cc.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_found_city IS NOT NULL THEN
        v_city_found := true;
        CONTINUE;
      END IF;
    END IF;
    
    -- البحث عن المنطقة بعد إيجاد المدينة (استخدام regions_cache إذا كان موجود، وإلا استخدام بحث بسيط)
    IF v_city_found AND NOT v_region_found AND length(v_word) >= 2 THEN
      -- محاولة البحث في regions_cache أولاً
      IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'regions_cache') THEN
        SELECT rc.name INTO v_found_region
        FROM regions_cache rc 
        WHERE rc.is_active = true 
          AND (lower(rc.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(rc.name) || '%')
        ORDER BY 
          CASE WHEN lower(rc.name) = v_word THEN 1
               WHEN lower(rc.name) LIKE v_word || '%' THEN 2
               ELSE 3 END
        LIMIT 1;
      ELSE
        -- إذا لم توجد regions_cache، اعتبر الكلمة التالية منطقة إذا لم تكن منتج أو رقم
        IF v_word NOT IN ('تيشرت', 'تشيرت', 'بنطال', 'جينز', 'قميص', 'فستان', 'برشلونة', 'ارجنتين', 'ريال', 'مدريد') 
           AND v_word !~ '^[0-9]+$' THEN
          v_found_region := v_word;
        END IF;
      END IF;
      
      IF v_found_region IS NOT NULL THEN
        v_region_found := true;
        v_current_index := array_position(v_words, v_word) + 1;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج الجزء المتبقي بعد المدينة والمنطقة
  IF v_city_found AND v_region_found AND v_current_index <= array_length(v_words, 1) THEN
    FOR i IN v_current_index..array_length(v_words, 1)
    LOOP
      -- تجاهل أرقام الهاتف (أي رقم طويل)
      IF v_words[i] ~ '^[0-9]{7,}$' THEN
        CONTINUE;
      END IF;
      
      -- تجاهل الأرقام القصيرة (أرقام المنتجات أو الكميات)
      IF v_words[i] ~ '^[0-9]{1,3}$' THEN
        CONTINUE;
      END IF;
      
      -- تجاهل أسماء المنتجات المعروفة وألوان وأحجام
      IF v_words[i] IN ('تيشرت', 'تشيرت', 'بنطال', 'جينز', 'قميص', 'فستان', 
                        'برشلونة', 'ارجنتين', 'ريال', 'مدريد', 'باريس', 'سان', 'جيرمان',
                        'احمر', 'اخضر', 'ازرق', 'اصفر', 'اسود', 'ابيض', 'بني', 'رمادي',
                        'كبير', 'صغير', 'وسط', 'ميديم', 'لارج', 'سمول', 'اكس',
                        'xl', 'xxl', 'xxxl', 's', 'm', 'l', 'xs') THEN
        CONTINUE;
      END IF;
      
      -- إضافة الكلمة إذا كانت طويلة بما فيه الكفاية
      IF length(v_words[i]) >= 2 THEN
        v_address_parts := array_append(v_address_parts, v_words[i]);
      END IF;
    END LOOP;
    
    -- تجميع أجزاء العنوان
    IF array_length(v_address_parts, 1) > 0 THEN
      v_remaining_text := array_to_string(v_address_parts, ' ');
      -- تنظيف العنوان النهائي
      v_remaining_text := trim(regexp_replace(v_remaining_text, E'\\s+', ' ', 'g'));
      
      -- إزالة أي بقايا من أسماء المدن أو المناطق
      v_remaining_text := regexp_replace(v_remaining_text, '\\b' || lower(COALESCE(v_found_city, '')) || '\\b', '', 'gi');
      v_remaining_text := regexp_replace(v_remaining_text, '\\b' || lower(COALESCE(v_found_region, '')) || '\\b', '', 'gi');
      v_remaining_text := trim(regexp_replace(v_remaining_text, E'\\s+', ' ', 'g'));
    END IF;
  END IF;
  
  -- إرجاع العنوان المستخرج أو NULL إذا لم يوجد أو كان قصيراً جداً
  RETURN CASE 
    WHEN length(trim(v_remaining_text)) >= 3 THEN v_remaining_text
    ELSE NULL
  END;
END;
$function$;