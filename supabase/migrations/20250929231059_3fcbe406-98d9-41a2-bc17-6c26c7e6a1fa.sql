-- Fix process_telegram_order to use existing extract_product_items_from_text function
-- and properly handle smart city/region extraction

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_extracted_items jsonb;
  v_extracted_address text;
  v_customer_city text;
  v_customer_province text;
  v_customer_phone text;
  v_customer_name text := 'عميل';
  v_total_amount numeric := 0;
  v_city_id integer;
  v_region_id integer;
  v_words text[];
  v_phone_extracted boolean := false;
  v_city_extracted boolean := false;
  v_success boolean := true;
  v_message text := 'تم معالجة الطلب بنجاح';
BEGIN
  RAISE NOTICE '🔄 معالجة رسالة تليغرام: %', p_message_text;
  
  -- استخراج المنتجات من النص باستخدام الدالة الموجودة
  SELECT extract_product_items_from_text(p_message_text) INTO v_extracted_items;
  
  -- تقسيم النص إلى كلمات للمعالجة
  v_words := string_to_array(lower(trim(p_message_text)), ' ');
  
  -- استخراج رقم الهاتف
  FOR i IN 1..array_length(v_words, 1) LOOP
    IF v_words[i] ~ '^[0-9]{7,11}$' THEN
      v_customer_phone := v_words[i];
      v_phone_extracted := true;
      EXIT;
    END IF;
  END LOOP;
  
  -- البحث الذكي عن المدينة
  FOR i IN 1..array_length(v_words, 1) LOOP
    IF length(v_words[i]) >= 2 THEN
      -- البحث عن المدينة
      SELECT 
        cc.id, cc.name
      INTO v_city_id, v_customer_city
      FROM cities_cache cc 
      WHERE cc.is_active = true 
        AND (lower(cc.name) LIKE '%' || v_words[i] || '%' OR v_words[i] LIKE '%' || lower(cc.name) || '%')
      ORDER BY 
        CASE WHEN lower(cc.name) = v_words[i] THEN 1
             WHEN lower(cc.name) LIKE v_words[i] || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_customer_city IS NOT NULL THEN
        v_city_extracted := true;
        
        -- البحث عن المنطقة بعد إيجاد المدينة
        FOR j IN (i+1)..array_length(v_words, 1) LOOP
          IF length(v_words[j]) >= 2 THEN
            -- محاولة البحث في regions_cache أولاً
            IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'regions_cache') THEN
              SELECT rc.id, rc.name
              INTO v_region_id, v_customer_province
              FROM regions_cache rc 
              WHERE rc.is_active = true 
                AND rc.city_id = v_city_id
                AND (lower(rc.name) LIKE '%' || v_words[j] || '%' OR v_words[j] LIKE '%' || lower(rc.name) || '%')
              ORDER BY 
                CASE WHEN lower(rc.name) = v_words[j] THEN 1
                     WHEN lower(rc.name) LIKE v_words[j] || '%' THEN 2
                     ELSE 3 END
              LIMIT 1;
            END IF;
            
            -- إذا وُجدت المنطقة، توقف عن البحث
            IF v_customer_province IS NOT NULL THEN
              EXIT;
            END IF;
          END IF;
        END LOOP;
        
        -- إذا لم توجد منطقة، استخدم اسم المدينة كمنطقة افتراضية
        IF v_customer_province IS NULL THEN
          v_customer_province := v_customer_city;
        END IF;
        
        EXIT; -- توقف عند أول مدينة موجودة
      END IF;
    END IF;
  END LOOP;
  
  -- حساب المبلغ الإجمالي من المنتجات المستخرجة
  IF v_extracted_items IS NOT NULL AND jsonb_typeof(v_extracted_items) = 'array' THEN
    SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
    INTO v_total_amount
    FROM jsonb_array_elements(v_extracted_items) AS item;
  END IF;
  
  -- التحقق من وجود منتج غير متوفر
  IF v_extracted_items IS NOT NULL AND jsonb_typeof(v_extracted_items) = 'array' THEN
    FOR i IN 0..(jsonb_array_length(v_extracted_items) - 1) LOOP
      IF (v_extracted_items->i->>'is_available')::boolean = false THEN
        v_success := false;
        v_message := COALESCE(v_extracted_items->i->>'alternatives_message', 'المنتج غير متوفر');
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- استخراج العنوان النظيف (أقرب نقطة دالة) من النص الأصلي
  v_extracted_address := extract_actual_address(p_message_text, v_customer_city);
  
  RAISE NOTICE '✅ نتائج الاستخراج - المدينة: %, المنطقة: %, الهاتف: %, العنوان: %', 
    v_customer_city, v_customer_province, v_customer_phone, v_extracted_address;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', v_success,
    'order_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', v_customer_city,
      'customer_province', v_customer_province,
      'customer_address', COALESCE(v_extracted_address, ''), -- العنوان النظيف فقط
      'city_id', v_city_id,
      'region_id', v_region_id,
      'items', COALESCE(v_extracted_items, '[]'::jsonb),
      'total_amount', v_total_amount,
      'original_text', p_message_text,
      'created_by', '91484496-b887-44f7-9e5d-be9db5567604'::uuid -- المدير الافتراضي
    ),
    'message', v_message,
    'options_type', CASE 
      WHEN NOT v_city_extracted THEN 'city_selection'
      WHEN NOT v_phone_extracted THEN 'phone_required'
      ELSE NULL
    END,
    'suggested_cities', CASE 
      WHEN NOT v_city_extracted THEN 'يرجى تحديد المدينة بوضوح'
      ELSE NULL
    END
  );
END;
$function$;