-- إصلاح شامل لمعالجة العنوان بشكل تسلسلي: المدينة -> المنطقة -> أقرب نقطة دالة

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, bigint);

-- إنشاء دالة محسنة لمعالجة العنوان بشكل تسلسلي
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_employee_code text DEFAULT NULL::text, p_chat_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_phone text;
  v_customer_address text;
  v_original_address text;
  v_customer_city text;
  v_customer_region text;
  v_landmark text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_total_with_delivery numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_city_id integer;
  v_region_id integer;
  v_order_id uuid;
  v_address_words text[];
  v_word text;
  v_word_index integer := 1;
  v_found_city boolean := false;
  v_found_region boolean := false;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة الطلب: %', p_order_data;
  
  -- استخراج البيانات الأساسية
  v_customer_phone := COALESCE(p_order_data->>'customer_phone', '');
  v_original_address := COALESCE(p_order_data->>'customer_address', '');
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);
  
  -- تقسيم العنوان إلى كلمات للمعالجة التسلسلية
  IF v_original_address IS NOT NULL AND v_original_address != '' THEN
    v_address_words := string_to_array(trim(v_original_address), ' ');
    RAISE NOTICE '📍 تقسيم العنوان: %', v_address_words;
    
    -- البحث التسلسلي: المدينة أولاً
    FOREACH v_word IN ARRAY v_address_words
    LOOP
      EXIT WHEN v_found_city; -- توقف عند العثور على المدينة
      
      IF length(trim(v_word)) > 1 THEN
        SELECT id, name INTO v_city_id, v_customer_city
        FROM cities_cache
        WHERE is_active = true
          AND (
            lower(name) = lower(trim(v_word))
            OR lower(name) LIKE '%' || lower(trim(v_word)) || '%'
            OR lower(trim(v_word)) LIKE '%' || lower(name) || '%'
          )
        ORDER BY 
          CASE WHEN lower(name) = lower(trim(v_word)) THEN 1
               WHEN lower(name) LIKE lower(trim(v_word)) || '%' THEN 2
               ELSE 3 END
        LIMIT 1;
        
        IF v_city_id IS NOT NULL THEN
          v_found_city := true;
          RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %) في الموضع: %', v_customer_city, v_city_id, v_word_index;
        END IF;
      END IF;
      
      v_word_index := v_word_index + 1;
    END LOOP;
    
    -- البحث عن المنطقة: ابدأ من الكلمة التالية للمدينة
    IF v_found_city AND v_city_id IS NOT NULL THEN
      DECLARE
        v_search_start integer := v_word_index; -- البحث من الكلمة التالية للمدينة
        v_current_index integer := v_search_start;
      BEGIN
        WHILE v_current_index <= array_length(v_address_words, 1) AND NOT v_found_region
        LOOP
          v_word := v_address_words[v_current_index];
          
          IF length(trim(v_word)) > 1 THEN
            SELECT id, name INTO v_region_id, v_customer_region
            FROM regions_cache
            WHERE city_id = v_city_id -- فقط المناطق في المدينة المحددة
              AND is_active = true
              AND (
                lower(name) = lower(trim(v_word))
                OR lower(name) LIKE '%' || lower(trim(v_word)) || '%'
                OR lower(trim(v_word)) LIKE '%' || lower(name) || '%'
              )
            ORDER BY 
              CASE WHEN lower(name) = lower(trim(v_word)) THEN 1
                   WHEN lower(name) LIKE lower(trim(v_word)) || '%' THEN 2
                   ELSE 3 END
            LIMIT 1;
            
            IF v_region_id IS NOT NULL THEN
              v_found_region := true;
              RAISE NOTICE '🗺️ تم العثور على المنطقة: % (ID: %) في الموضع: %', v_customer_region, v_region_id, v_current_index;
              
              -- استخراج أقرب نقطة دالة من الكلمات المتبقية
              IF v_current_index < array_length(v_address_words, 1) THEN
                DECLARE
                  v_landmark_words text[];
                  v_i integer;
                BEGIN
                  v_landmark_words := ARRAY[]::text[];
                  FOR v_i IN (v_current_index + 1)..array_length(v_address_words, 1)
                  LOOP
                    v_landmark_words := array_append(v_landmark_words, v_address_words[v_i]);
                  END LOOP;
                  v_landmark := trim(array_to_string(v_landmark_words, ' '));
                END;
              END IF;
              
              EXIT;
            END IF;
          END IF;
          
          v_current_index := v_current_index + 1;
        END LOOP;
      END;
    END IF;
    
    -- بناء العنوان الكامل للعرض
    IF v_found_city AND v_found_region THEN
      v_customer_address := v_customer_city || ' ' || v_customer_region || 
        CASE WHEN v_landmark IS NOT NULL AND v_landmark != '' THEN ' ' || v_landmark ELSE '' END;
    ELSIF v_found_city THEN
      v_customer_address := v_customer_city || ' ' || v_original_address;
    ELSE
      v_customer_address := v_original_address;
    END IF;
    
    RAISE NOTICE '📍 نتيجة تحليل العنوان: المدينة=% (ID: %), المنطقة=% (ID: %), أقرب نقطة دالة=%', 
      v_customer_city, v_city_id, v_customer_region, v_region_id, v_landmark;
  END IF;
  
  -- حساب المبلغ الإجمالي مع أجور التوصيل
  v_total_with_delivery := v_total_amount + v_delivery_fee;
  
  -- إنشاء الطلب في ai_orders
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    city_id,
    region_id,
    status,
    total_amount,
    created_by,
    source,
    telegram_chat_id,
    items,
    order_data,
    original_text
  ) VALUES (
    COALESCE(p_order_data->>'customer_name', 'عميل تليغرام'),
    v_customer_phone,
    v_customer_city,
    v_customer_region, -- حفظ اسم المنطقة في customer_province
    v_customer_address, -- العنوان الكامل للعرض
    v_city_id,
    v_region_id,
    'pending',
    v_total_with_delivery,
    p_employee_code,
    'telegram',
    p_chat_id,
    v_items,
    jsonb_build_object(
      'items', v_items,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'city_name', v_customer_city,
      'region_name', v_customer_region,
      'landmark', v_landmark,
      'delivery_fee', v_delivery_fee,
      'product_total', v_total_amount,
      'final_total', v_total_with_delivery
    ),
    COALESCE(p_order_data->>'original_text', '')
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح - ID: %، المبلغ الإجمالي: %', v_order_id, v_total_with_delivery;
  
  -- إرجاع النتيجة مع التنسيق الصحيح للعرض
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', COALESCE(p_order_data->>'customer_name', 'عميل تليغرام'),
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_region', v_customer_region,
    'customer_address', v_customer_address,
    'landmark', v_landmark,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'items', v_items,
    'product_total', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'final_amount', v_total_with_delivery,
    'total_amount', v_total_with_delivery
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'product_total', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_with_delivery
    );
END;
$function$;