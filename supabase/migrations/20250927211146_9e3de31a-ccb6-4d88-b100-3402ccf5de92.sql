-- إصلاح وظيفة البحث الذكي للمناطق
CREATE OR REPLACE FUNCTION public.smart_search_region(p_search_term text)
RETURNS TABLE(
  region_id integer,
  region_name text,
  city_id integer,
  city_name text,
  confidence numeric,
  match_type text
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_normalized_search text;
  v_search_words text[];
BEGIN
  -- تطبيع النص المدخل
  v_normalized_search := lower(trim(regexp_replace(p_search_term, '[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]', '', 'g')));
  v_search_words := string_to_array(v_normalized_search, ' ');

  RETURN QUERY
  WITH search_matches AS (
    -- البحث المباشر في أسماء المناطق
    SELECT DISTINCT
      r.id as region_id,
      r.name as region_name,
      r.city_id,
      c.name as city_name,
      CASE 
        WHEN lower(r.name) = v_normalized_search THEN 1.0
        WHEN lower(r.name) LIKE v_normalized_search || '%' THEN 0.9
        WHEN lower(r.name) LIKE '%' || v_normalized_search || '%' THEN 0.8
        ELSE 0.7
      END as confidence,
      'direct_name' as match_type
    FROM public.regions_cache r
    JOIN public.cities_cache c ON r.city_id = c.id
    WHERE r.is_active = true
      AND c.is_active = true
      AND (
        lower(r.name) = v_normalized_search
        OR lower(r.name) LIKE '%' || v_normalized_search || '%'
        OR similarity(lower(r.name), v_normalized_search) > 0.3
      )

    UNION ALL

    -- البحث في المرادفات
    SELECT DISTINCT
      r.id as region_id,
      r.name as region_name,
      r.city_id,
      c.name as city_name,
      GREATEST(ra.confidence_score * 
        CASE 
          WHEN ra.normalized_name = v_normalized_search THEN 1.0
          WHEN ra.normalized_name LIKE v_normalized_search || '%' THEN 0.9
          WHEN ra.normalized_name LIKE '%' || v_normalized_search || '%' THEN 0.8
          ELSE 0.7
        END, 0.1) as confidence,
      'alias_match' as match_type
    FROM public.region_aliases ra
    JOIN public.regions_cache r ON ra.region_id = r.id
    JOIN public.cities_cache c ON r.city_id = c.id
    WHERE r.is_active = true
      AND c.is_active = true
      AND (
        ra.normalized_name = v_normalized_search
        OR ra.normalized_name LIKE '%' || v_normalized_search || '%'
        OR similarity(ra.normalized_name, v_normalized_search) > 0.3
      )
  )
  SELECT DISTINCT
    sm.region_id,
    sm.region_name,
    sm.city_id,
    sm.city_name,
    sm.confidence,
    sm.match_type
  FROM search_matches sm
  WHERE sm.confidence >= 0.4
  ORDER BY sm.confidence DESC, sm.region_name
  LIMIT 10;
END;
$function$;

-- إضافة قيد فريد لجدول المرادفات إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'region_aliases_region_id_normalized_name_key'
  ) THEN
    ALTER TABLE public.region_aliases 
    ADD CONSTRAINT region_aliases_region_id_normalized_name_key 
    UNIQUE (region_id, normalized_name);
  END IF;
END $$;

-- تنظيف المرادفات المكررة
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY region_id, normalized_name ORDER BY created_at DESC) as rn
  FROM public.region_aliases
)
DELETE FROM public.region_aliases 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- إضافة مرادفات شاملة لمناطق بغداد
INSERT INTO public.region_aliases (region_id, alias_name, normalized_name, confidence_score) 
SELECT DISTINCT r.id, alias_data.alias, lower(trim(alias_data.alias)), alias_data.confidence
FROM public.regions_cache r
JOIN public.cities_cache c ON r.city_id = c.id
CROSS JOIN (VALUES 
  ('الصحة', 'دورة صحة', 1.0),
  ('الصحة', 'دوره صحه', 0.95),
  ('الصحة', 'منطقة الصحة', 0.9),
  ('الصحة', 'صحة', 0.85),
  ('الصحة', 'صحه', 0.85),
  ('الصحة', 'حي الصحة', 0.9),
  ('الشامية', 'الشامية', 1.0),
  ('الشامية', 'شامية', 0.95),
  ('الشامية', 'الشاميه', 0.9),
  ('الشامية', 'شاميه', 0.85),
  ('الجامعة', 'الجامعة', 1.0),
  ('الجامعة', 'جامعة', 0.95),
  ('الجامعة', 'منطقة الجامعة', 0.9),
  ('الجامعة', 'حي الجامعة', 0.9),
  ('الجامعة', 'الجامعه', 0.9),
  ('الكرادة الشرقية', 'الكرادة', 0.9),
  ('الكرادة الشرقية', 'كرادة شرقية', 1.0),
  ('الكرادة الشرقية', 'الكراده الشرقيه', 0.9),
  ('الكرادة الشرقية', 'كراده', 0.85),
  ('الكرادة الغربية', 'كرادة غربية', 1.0),
  ('الكرادة الغربية', 'الكراده الغربيه', 0.9),
  ('المنصور', 'المنصور', 1.0),
  ('المنصور', 'منصور', 0.95),
  ('المنصور', 'المنصوريه', 0.85),
  ('المنصور', 'منطقة المنصور', 0.9),
  ('الحرية', 'الحرية', 1.0),
  ('الحرية', 'حرية', 0.95),
  ('الحرية', 'الحريه', 0.9),
  ('الحرية', 'حي الحرية', 0.9),
  ('العدل', 'العدل', 1.0),
  ('العدل', 'عدل', 0.95),
  ('العدل', 'منطقة العدل', 0.9),
  ('العدل', 'حي العدل', 0.9),
  ('الكاظمية', 'الكاظمية', 1.0),
  ('الكاظمية', 'كاظمية', 0.95),
  ('الكاظمية', 'الكاظميه', 0.9),
  ('الكاظمية', 'منطقة الكاظمية', 0.9),
  ('الاعظمية', 'الاعظمية', 1.0),
  ('الاعظمية', 'اعظمية', 0.95),
  ('الأعظمية', 'الأعظمية', 1.0),
  ('الاعظمية', 'الاعظميه', 0.9),
  ('الجادرية', 'الجادرية', 1.0),
  ('الجادرية', 'جادرية', 0.95),
  ('الجادرية', 'الجادريه', 0.9),
  ('زيونة', 'زيونة', 1.0),
  ('زيونة', 'زيونه', 0.9),
  ('زيونة', 'منطقة زيونة', 0.9),
  ('الشعلة', 'الشعلة', 1.0),
  ('الشعلة', 'شعلة', 0.95),
  ('الشعلة', 'الشعله', 0.9),
  ('الغزالية', 'الغزالية', 1.0),
  ('الغزالية', 'غزالية', 0.95),
  ('الغزالية', 'الغزاليه', 0.9),
  ('البياع', 'البياع', 1.0),
  ('البياع', 'بياع', 0.95),
  ('البياع', 'منطقة البياع', 0.9),
  ('الحيدرية', 'الحيدرية', 1.0),
  ('الحيدرية', 'حيدرية', 0.95),
  ('الحيدرية', 'الحيدريه', 0.9),
  ('الطالبية', 'الطالبية', 1.0),
  ('الطالبية', 'طالبية', 0.95),
  ('الطالبية', 'الطالبيه', 0.9),
  ('المأمون', 'المأمون', 1.0),
  ('المأمون', 'مأمون', 0.95),
  ('المأمون', 'المامون', 0.9),
  ('اليرموك', 'اليرموك', 1.0),
  ('اليرموك', 'يرموك', 0.95),
  ('القادسية', 'القادسية', 1.0),
  ('القادسية', 'قادسية', 0.95),
  ('القادسية', 'القادسيه', 0.9),
  ('العامرية', 'العامرية', 1.0),
  ('العامرية', 'عامرية', 0.95),
  ('العامرية', 'العامريه', 0.9),
  ('الدورة', 'الدورة', 1.0),
  ('الدورة', 'دورة', 0.95),
  ('الدورة', 'الدوره', 0.9),
  ('السيدية', 'السيدية', 1.0),
  ('السيدية', 'سيدية', 0.95),
  ('السيدية', 'السيديه', 0.9),
  ('الرشيد', 'الرشيد', 1.0),
  ('الرشيد', 'رشيد', 0.95),
  ('الرشيد', 'منطقة الرشيد', 0.9),
  ('الزعفرانية', 'الزعفرانية', 1.0),
  ('الزعفرانية', 'زعفرانية', 0.95),
  ('الزعفرانية', 'الزعفرانيه', 0.9),
  ('الزعفرانية', 'زعفرانيه', 0.85)
) AS alias_data(region_name, alias, confidence)
WHERE c.name = 'بغداد' AND lower(r.name) = lower(alias_data.region_name)
ON CONFLICT (region_id, normalized_name) DO UPDATE SET
  alias_name = EXCLUDED.alias_name,
  confidence_score = EXCLUDED.confidence_score,
  updated_at = now();

-- إضافة مرادفات إضافية لجميع المناطق
WITH region_variations AS (
  SELECT 
    r.id,
    r.name,
    unnest(ARRAY[
      'حي ' || r.name,
      'منطقة ' || r.name,
      CASE WHEN r.name LIKE 'ال%' THEN substring(r.name from 3) ELSE NULL END,
      CASE WHEN r.name NOT LIKE 'ال%' THEN 'ال' || r.name ELSE NULL END,
      replace(r.name, 'ة', 'ه'),
      replace(r.name, 'ه', 'ة')
    ]) AS alias_variation
  FROM public.regions_cache r
  JOIN public.cities_cache c ON r.city_id = c.id
  WHERE c.name = 'بغداد'
)
INSERT INTO public.region_aliases (region_id, alias_name, normalized_name, confidence_score)
SELECT DISTINCT 
  rv.id, 
  rv.alias_variation, 
  lower(trim(rv.alias_variation)), 
  0.8
FROM region_variations rv
WHERE rv.alias_variation IS NOT NULL 
  AND rv.alias_variation != rv.name
  AND length(trim(rv.alias_variation)) > 2
ON CONFLICT (region_id, normalized_name) DO NOTHING;

-- تحديث وظيفة معالجة طلبات التليغرام
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_id uuid;
  v_total_amount numeric := 26000;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_original_text text;
  v_employee_id uuid;
  v_default_manager_id uuid := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  v_ai_order_id uuid;
  v_found_city_id integer;
  v_found_city_name text;
  v_smart_city_result record;
  v_smart_region_result record;
  v_found_region_id integer;
  v_found_region_name text;
  v_confirmed_address text := '';
  v_success_message text := '';
  v_product_name text := 'منتج';
  v_product_color text := '';
  v_product_size text := '';
  v_quantity integer := 1;
  v_words text[];
  v_word text;
  v_text_lower text;
  v_phone_numbers text[];
BEGIN
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_original_text := p_order_data->>'original_text';

  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    v_employee_id := COALESCE(p_employee_id, v_default_manager_id);
  END IF;

  IF v_original_text IS NOT NULL AND trim(v_original_text) != '' THEN
    v_text_lower := lower(trim(v_original_text));
    
    v_phone_numbers := ARRAY(
      SELECT DISTINCT matches[1]
      FROM regexp_split_to_table(v_original_text, E'\n') AS line,
           regexp_matches(line, '(\d{11}|\d{10})', 'g') AS matches
      WHERE length(matches[1]) >= 10
    );
    
    IF array_length(v_phone_numbers, 1) > 0 THEN
      v_customer_phone := v_phone_numbers[1];
    END IF;
    
    IF v_text_lower ~ '(ارجنتين|ارجنتین)' THEN
      v_product_name := 'قميص أرجنتين';
    ELSIF v_text_lower ~ '(قميص|قمیص)' THEN
      v_product_name := 'قميص';
    ELSIF v_text_lower ~ '(بنطال|بنطلون)' THEN
      v_product_name := 'بنطال';
    ELSIF v_text_lower ~ '(جاكيت|جاکيت)' THEN
      v_product_name := 'جاكيت';
    END IF;
    
    IF v_text_lower ~ '(سمائي|سماوي)' THEN
      v_product_color := 'سمائي';
    ELSIF v_text_lower ~ '(احمر|أحمر)' THEN
      v_product_color := 'أحمر';
    ELSIF v_text_lower ~ '(ازرق|أزرق)' THEN
      v_product_color := 'أزرق';
    ELSIF v_text_lower ~ '(اسود|أسود)' THEN
      v_product_color := 'أسود';
    ELSIF v_text_lower ~ '(ابيض|أبيض)' THEN
      v_product_color := 'أبيض';
    ELSIF v_text_lower ~ '(اخضر|أخضر)' THEN
      v_product_color := 'أخضر';
    END IF;
    
    IF v_text_lower ~ '\m(m|ميديم|متوسط)\M' THEN
      v_product_size := 'M';
    ELSIF v_text_lower ~ '\m(l|لارج|كبير)\M' THEN
      v_product_size := 'L';
    ELSIF v_text_lower ~ '\m(xl|اكس لارج)\M' THEN
      v_product_size := 'XL';
    ELSIF v_text_lower ~ '\m(s|سمول|صغير)\M' THEN
      v_product_size := 'S';
    END IF;
    
    v_words := string_to_array(replace(replace(v_original_text, '،', ' '), ',', ' '), ' ');
    
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF length(trim(v_word)) >= 3 THEN
        SELECT * INTO v_smart_city_result 
        FROM smart_search_city(trim(v_word)) 
        WHERE confidence >= 0.7
        LIMIT 1;
        
        IF v_smart_city_result.city_id IS NOT NULL THEN
          v_found_city_id := v_smart_city_result.city_id;
          v_found_city_name := v_smart_city_result.city_name;
        END IF;
        
        SELECT * INTO v_smart_region_result 
        FROM smart_search_region(trim(v_word)) 
        WHERE confidence >= 0.7
        LIMIT 1;
        
        IF v_smart_region_result.region_id IS NOT NULL THEN
          v_found_region_id := v_smart_region_result.region_id;
          v_found_region_name := v_smart_region_result.region_name;
          
          IF v_found_city_id IS NULL THEN
            v_found_city_id := v_smart_region_result.city_id;
            v_found_city_name := v_smart_region_result.city_name;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_found_city_id IS NULL THEN
    SELECT id, name INTO v_found_city_id, v_found_city_name
    FROM cities_cache 
    WHERE lower(name) = 'بغداد' 
    LIMIT 1;
  END IF;

  v_customer_city := v_found_city_name;

  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = v_customer_phone
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      UPDATE public.customers 
      SET 
        name = v_customer_name,
        address = v_customer_address,
        city = v_customer_city,
        province = v_customer_province,
        updated_at = now()
      WHERE id = v_customer_id;
    ELSE
      INSERT INTO public.customers (
        name, phone, address, city, province, created_by
      ) VALUES (
        v_customer_name, v_customer_phone, v_customer_address, 
        v_customer_city, v_customer_province, v_employee_id
      ) RETURNING id INTO v_customer_id;
    END IF;
  ELSE
    INSERT INTO public.customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      v_customer_name, v_customer_phone, v_customer_address, 
      v_customer_city, v_customer_province, v_employee_id
    ) RETURNING id INTO v_customer_id;
  END IF;

  v_confirmed_address := v_found_city_name;
  IF v_found_region_name IS NOT NULL THEN
    v_confirmed_address := v_confirmed_address || ' - ' || v_found_region_name;
  END IF;

  INSERT INTO public.ai_orders (
    telegram_chat_id, customer_name, customer_phone, customer_address,
    customer_city, customer_province, city_id, region_id, items, total_amount, 
    original_text, status, source, created_by, order_data
  ) VALUES (
    p_chat_id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_province, v_found_city_id, v_found_region_id, 
    p_order_data->'items', v_total_amount, v_original_text, 
    'pending', 'telegram', v_employee_id, p_order_data
  ) RETURNING id INTO v_ai_order_id;

  v_success_message := '✅ تم استلام الطلب!' || E'\n';
  v_success_message := v_success_message || '📍 ' || v_confirmed_address;
  
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    v_success_message := v_success_message || E'\n📱 ' || v_customer_phone;
  END IF;
  
  v_success_message := v_success_message || E'\n✅ ' || v_product_name;
  IF v_product_color IS NOT NULL AND v_product_color != '' THEN
    v_success_message := v_success_message || ' (' || v_product_color || ')';
  END IF;
  IF v_product_size IS NOT NULL AND v_product_size != '' THEN
    v_success_message := v_success_message || ' ' || v_product_size;
  END IF;
  v_success_message := v_success_message || ' × ' || v_quantity;
  
  v_success_message := v_success_message || E'\n💰 ' || to_char(v_total_amount, 'FM999,999') || ' د.ع';

  RETURN jsonb_build_object(
    'success', true,
    'message', v_success_message,
    'confirmed_address', v_confirmed_address,
    'city_name', v_found_city_name,
    'region_name', v_found_region_name,
    'ai_order_id', v_ai_order_id,
    'customer_id', v_customer_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'خطأ في معالجة طلب تليغرام: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'processing_error',
    'message', '⚠️ حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
    'details', SQLERRM
  );
END;
$function$;