-- حذف جميع الوظائف المكررة
DROP FUNCTION IF EXISTS public.smart_search_region(text);
DROP FUNCTION IF EXISTS public.smart_search_city(text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid);

-- إعادة إنشاء وظيفة البحث الذكي للمدن
CREATE OR REPLACE FUNCTION public.smart_search_city(search_text text)
RETURNS TABLE(city_id integer, city_name text, confidence numeric)
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

-- إعادة إنشاء وظيفة البحث الذكي للمناطق مع إصلاح المشكلة
CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text)
RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, confidence numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
BEGIN
  normalized_search := lower(trim(search_text));
  
  RETURN QUERY
  -- البحث المباشر في المناطق
  SELECT 
    rc.id as region_id,
    rc.name as region_name,
    rc.city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(rc.name) = normalized_search THEN 1.0
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 0.9
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 0.8
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
  
  UNION ALL
  
  -- البحث في المرادفات
  SELECT 
    rc.id as region_id,
    rc.name as region_name,
    rc.city_id,
    cc.name as city_name,
    ra.confidence_score as confidence
  FROM region_aliases ra
  JOIN regions_cache rc ON ra.region_id = rc.id
  JOIN cities_cache cc ON rc.city_id = cc.id
  WHERE rc.is_active = true
    AND cc.is_active = true
    AND (
      lower(ra.alias_name) = normalized_search
      OR lower(ra.alias_name) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || lower(ra.alias_name) || '%'
    )
  
  ORDER BY confidence DESC, region_name
  LIMIT 10;
END;
$function$;

-- إعادة إنشاء وظيفة معالجة الطلبات مع تحسينات
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
  v_product_name text := '';
  v_product_color text := '';
  v_product_size text := '';
  v_quantity integer := 1;
  v_words text[];
  v_word text;
  v_text_lower text;
  v_phone_numbers text[];
  v_lines text[];
  v_line text;
BEGIN
  -- استخراج البيانات الأساسية
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_original_text := p_order_data->>'original_text';

  -- تحديد الموظف المسؤول
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    v_employee_id := COALESCE(p_employee_id, v_default_manager_id);
  END IF;

  -- معالجة النص الأصلي
  IF v_original_text IS NOT NULL AND trim(v_original_text) != '' THEN
    v_text_lower := lower(trim(v_original_text));
    
    -- تقسيم النص إلى أسطر للمعالجة
    v_lines := string_to_array(v_original_text, E'\n');
    
    -- استخراج أرقام الهواتف
    FOREACH v_line IN ARRAY v_lines
    LOOP
      -- البحث عن أرقام الهواتف في كل سطر
      SELECT array_agg(DISTINCT matches[1]) INTO v_phone_numbers
      FROM regexp_matches(v_line, '(07\d{9}|\d{11})', 'g') AS matches
      WHERE length(matches[1]) >= 10;
      
      IF v_phone_numbers IS NOT NULL AND array_length(v_phone_numbers, 1) > 0 THEN
        v_customer_phone := v_phone_numbers[1];
        EXIT; -- خروج من الحلقة عند العثور على رقم
      END IF;
    END LOOP;
    
    -- استخراج تفاصيل المنتج
    IF v_text_lower ~ '(ارجنتين|ارجنتین)' THEN
      v_product_name := 'قميص أرجنتين';
    ELSIF v_text_lower ~ '(قميص|قمیص)' THEN
      v_product_name := 'قميص';
    ELSIF v_text_lower ~ '(بنطال|بنطلون)' THEN
      v_product_name := 'بنطال';
    ELSIF v_text_lower ~ '(جاكيت|جاکيت)' THEN
      v_product_name := 'جاكيت';
    ELSE
      v_product_name := 'منتج';
    END IF;
    
    -- استخراج اللون
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
    
    -- استخراج المقاس
    IF v_text_lower ~ '\m(m|ميديم|متوسط|medium)\M' THEN
      v_product_size := 'M';
    ELSIF v_text_lower ~ '\m(l|لارج|كبير|large)\M' THEN
      v_product_size := 'L';
    ELSIF v_text_lower ~ '\m(xl|اكس لارج|كبير جدا)\M' THEN
      v_product_size := 'XL';
    ELSIF v_text_lower ~ '\m(s|سمول|صغير|small)\M' THEN
      v_product_size := 'S';
    END IF;
    
    -- تقسيم النص إلى كلمات للبحث عن المدن والمناطق
    v_words := string_to_array(replace(replace(v_original_text, '،', ' '), ',', ' '), ' ');
    
    -- البحث الذكي عن المدن والمناطق
    FOREACH v_word IN ARRAY v_words
    LOOP
      v_word := trim(v_word);
      
      IF length(v_word) >= 3 THEN
        -- البحث عن المدينة
        SELECT * INTO v_smart_city_result 
        FROM smart_search_city(v_word) 
        WHERE confidence >= 0.7
        LIMIT 1;
        
        IF v_smart_city_result.city_id IS NOT NULL THEN
          v_found_city_id := v_smart_city_result.city_id;
          v_found_city_name := v_smart_city_result.city_name;
        END IF;
        
        -- البحث عن المنطقة
        SELECT * INTO v_smart_region_result 
        FROM smart_search_region(v_word) 
        WHERE confidence >= 0.7
        LIMIT 1;
        
        IF v_smart_region_result.region_id IS NOT NULL THEN
          v_found_region_id := v_smart_region_result.region_id;
          v_found_region_name := v_smart_region_result.region_name;
          
          -- إذا لم نجد مدينة، نأخذها من المنطقة
          IF v_found_city_id IS NULL THEN
            v_found_city_id := v_smart_region_result.city_id;
            v_found_city_name := v_smart_region_result.city_name;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- استخدام بغداد كمدينة افتراضية
  IF v_found_city_id IS NULL THEN
    SELECT id, name INTO v_found_city_id, v_found_city_name
    FROM cities_cache 
    WHERE lower(name) = 'بغداد' 
    LIMIT 1;
  END IF;

  v_customer_city := v_found_city_name;

  -- التعامل مع العملاء
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = v_customer_phone
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      UPDATE public.customers 
      SET 
        name = COALESCE(v_customer_name, name),
        address = COALESCE(v_customer_address, address),
        city = COALESCE(v_customer_city, city),
        province = COALESCE(v_customer_province, province),
        updated_at = now()
      WHERE id = v_customer_id;
    ELSE
      INSERT INTO public.customers (
        name, phone, address, city, province, created_by
      ) VALUES (
        COALESCE(v_customer_name, 'عميل'), v_customer_phone, v_customer_address, 
        v_customer_city, v_customer_province, v_employee_id
      ) RETURNING id INTO v_customer_id;
    END IF;
  ELSE
    INSERT INTO public.customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      COALESCE(v_customer_name, 'عميل'), v_customer_phone, v_customer_address, 
      v_customer_city, v_customer_province, v_employee_id
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- تجهيز العنوان المؤكد
  v_confirmed_address := COALESCE(v_found_city_name, 'غير محدد');
  IF v_found_region_name IS NOT NULL THEN
    v_confirmed_address := v_confirmed_address || ' - ' || v_found_region_name;
  END IF;

  -- إنشاء طلب AI
  INSERT INTO public.ai_orders (
    telegram_chat_id, customer_name, customer_phone, customer_address,
    customer_city, customer_province, city_id, region_id, items, total_amount, 
    original_text, status, source, created_by, order_data
  ) VALUES (
    p_chat_id, COALESCE(v_customer_name, 'عميل'), v_customer_phone, v_customer_address,
    v_customer_city, v_customer_province, v_found_city_id, v_found_region_id, 
    p_order_data->'items', v_total_amount, v_original_text, 
    'pending', 'telegram', v_employee_id, p_order_data
  ) RETURNING id INTO v_ai_order_id;

  -- تجهيز رسالة النجاح
  v_success_message := '✅ تم استلام طلبك بنجاح!' || E'\n\n';
  v_success_message := v_success_message || '📍 العنوان: ' || v_confirmed_address || E'\n';
  
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    v_success_message := v_success_message || '📱 الهاتف: ' || v_customer_phone || E'\n';
  END IF;
  
  v_success_message := v_success_message || '🛍️ المنتج: ' || v_product_name;
  IF v_product_color IS NOT NULL AND v_product_color != '' THEN
    v_success_message := v_success_message || ' (' || v_product_color || ')';
  END IF;
  IF v_product_size IS NOT NULL AND v_product_size != '' THEN
    v_success_message := v_success_message || ' مقاس ' || v_product_size;
  END IF;
  v_success_message := v_success_message || E'\n';
  
  v_success_message := v_success_message || '💰 السعر: ' || to_char(v_total_amount, 'FM999,999') || ' د.ع' || E'\n\n';
  v_success_message := v_success_message || '🚚 سيتم التواصل معك لتأكيد الطلب والتوصيل';

  RETURN jsonb_build_object(
    'success', true,
    'message', v_success_message,
    'confirmed_address', v_confirmed_address,
    'city_name', v_found_city_name,
    'region_name', v_found_region_name,
    'ai_order_id', v_ai_order_id,
    'customer_id', v_customer_id,
    'product_details', jsonb_build_object(
      'name', v_product_name,
      'color', v_product_color,
      'size', v_product_size
    )
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'خطأ في معالجة طلب تليغرام: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'processing_error',
    'message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة أو التواصل مع الدعم.',
    'details', SQLERRM
  );
END;
$function$;