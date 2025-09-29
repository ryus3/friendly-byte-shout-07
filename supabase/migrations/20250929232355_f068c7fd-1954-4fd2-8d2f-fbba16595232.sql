-- إصلاح عاجل لدالة process_telegram_order لاستعادة استخراج الهاتف ورسوم التوصيل
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  input_text text,
  employee_id uuid DEFAULT '91484496-b887-44f7-9e5d-be9db5567604'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_extracted_phone text;
  v_extracted_city text;
  v_extracted_region text;
  v_extracted_address text;
  v_extracted_items jsonb;
  v_city_id integer;
  v_region_id integer;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000; -- رسوم توصيل افتراضية
  v_result jsonb;
  v_phone_patterns text[] := ARRAY[
    '\+964\s*7\d{2}\s*\d{3}\s*\d{4}',     -- +964 7XX XXX XXXX
    '\+9647\d{8}',                        -- +9647XXXXXXXX
    '07\d{8}',                           -- 07XXXXXXXX
    '7\d{8}',                            -- 7XXXXXXXX
    '07\d{2}\s*\d{3}\s*\d{4}',          -- 07XX XXX XXXX
    '07\d{2}-\d{3}-\d{4}',              -- 07XX-XXX-XXXX
    '07\d{2}\.\d{3}\.\d{4}'             -- 07XX.XXX.XXXX
  ];
  v_pattern text;
  v_phone_match text;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام: %', input_text;
  
  -- استخراج رقم الهاتف مع دعم الأشكال المختلفة
  FOREACH v_pattern IN ARRAY v_phone_patterns
  LOOP
    v_phone_match := (regexp_matches(input_text, v_pattern, 'g'))[1];
    IF v_phone_match IS NOT NULL THEN
      -- تطبيع رقم الهاتف
      v_extracted_phone := regexp_replace(v_phone_match, '[^\d]', '', 'g');
      
      -- إضافة 964 إذا بدأ بـ 07
      IF v_extracted_phone ~ '^07' THEN
        v_extracted_phone := '964' || substring(v_extracted_phone from 2);
      -- إضافة 964 إذا بدأ بـ 7
      ELSIF v_extracted_phone ~ '^7' AND length(v_extracted_phone) = 9 THEN
        v_extracted_phone := '964' || v_extracted_phone;
      END IF;
      
      -- تنسيق نهائي: +9647XXXXXXXX
      IF v_extracted_phone ~ '^9647\d{8}$' THEN
        v_extracted_phone := '+' || v_extracted_phone;
        RAISE NOTICE '📱 تم استخراج رقم الهاتف: %', v_extracted_phone;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج العنوان والمدينة والمنطقة
  SELECT * INTO v_extracted_city, v_extracted_region, v_extracted_address 
  FROM extract_actual_address(input_text, v_extracted_city);
  
  RAISE NOTICE '🏙️ المدينة: %, المنطقة: %, العنوان: %', v_extracted_city, v_extracted_region, v_extracted_address;
  
  -- البحث عن معرف المدينة
  IF v_extracted_city IS NOT NULL THEN
    SELECT id INTO v_city_id 
    FROM cities_cache 
    WHERE lower(name) LIKE '%' || lower(v_extracted_city) || '%' 
       OR lower(v_extracted_city) LIKE '%' || lower(name) || '%'
    ORDER BY 
      CASE WHEN lower(name) = lower(v_extracted_city) THEN 1 ELSE 2 END
    LIMIT 1;
  END IF;
  
  -- البحث عن معرف المنطقة
  IF v_extracted_region IS NOT NULL AND v_city_id IS NOT NULL THEN
    SELECT id INTO v_region_id 
    FROM regions_cache 
    WHERE city_id = v_city_id 
      AND (lower(name) LIKE '%' || lower(v_extracted_region) || '%' 
           OR lower(v_extracted_region) LIKE '%' || lower(name) || '%')
    ORDER BY 
      CASE WHEN lower(name) = lower(v_extracted_region) THEN 1 ELSE 2 END
    LIMIT 1;
  END IF;
  
  -- استخراج المنتجات
  v_extracted_items := extract_product_items_from_text(input_text);
  
  -- حساب المبلغ الإجمالي للمنتجات
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0) 
  INTO v_total_amount
  FROM jsonb_array_elements(v_extracted_items) AS item;
  
  -- جلب رسوم التوصيل من الإعدادات
  SELECT COALESCE(delivery_fee::numeric, 5000) INTO v_delivery_fee
  FROM settings 
  WHERE key = 'delivery_fee' 
  LIMIT 1;
  
  -- إضافة رسوم التوصيل للمبلغ الإجمالي
  v_total_amount := v_total_amount + v_delivery_fee;
  
  RAISE NOTICE '💰 المبلغ الإجمالي: % (منتجات + توصيل %)', v_total_amount, v_delivery_fee;
  
  -- فحص توفر المنتجات
  IF jsonb_array_length(v_extracted_items) > 0 THEN
    DECLARE
      v_item jsonb;
      v_all_available boolean := true;
      v_alternatives_msg text := '';
    BEGIN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_extracted_items)
      LOOP
        IF NOT (v_item->>'is_available')::boolean THEN
          v_all_available := false;
          v_alternatives_msg := v_item->>'alternatives_message';
          EXIT;
        END IF;
      END LOOP;
      
      IF v_all_available THEN
        v_result := jsonb_build_object(
          'success', true,
          'message', 'تم معالجة الطلب بنجاح',
          'order_data', jsonb_build_object(
            'items', v_extracted_items,
            'customer_name', 'عميل',
            'customer_phone', v_extracted_phone,
            'customer_city', v_extracted_city,
            'customer_province', v_extracted_region,
            'customer_address', COALESCE(v_extracted_address, ''),
            'city_id', v_city_id,
            'region_id', v_region_id,
            'total_amount', v_total_amount,
            'delivery_fee', v_delivery_fee,
            'created_by', employee_id,
            'original_text', input_text
          ),
          'options_type', CASE 
            WHEN v_extracted_phone IS NULL THEN 'phone_required'
            ELSE 'complete'
          END
        );
      ELSE
        v_result := jsonb_build_object(
          'success', false,
          'message', v_alternatives_msg,
          'order_data', jsonb_build_object(
            'items', v_extracted_items,
            'customer_name', 'عميل',
            'customer_phone', v_extracted_phone,
            'customer_city', v_extracted_city,
            'customer_province', v_extracted_region,
            'customer_address', COALESCE(v_extracted_address, ''),
            'city_id', v_city_id,
            'region_id', v_region_id,
            'total_amount', v_total_amount,
            'delivery_fee', v_delivery_fee,
            'created_by', employee_id,
            'original_text', input_text
          ),
          'options_type', 'alternatives_needed'
        );
      END IF;
    END;
  ELSE
    v_result := jsonb_build_object(
      'success', false,
      'message', 'لم يتم التعرف على أي منتج في الطلب',
      'order_data', jsonb_build_object(
        'items', '[]'::jsonb,
        'customer_name', 'عميل',
        'customer_phone', v_extracted_phone,
        'customer_city', v_extracted_city,
        'customer_province', v_extracted_region,
        'customer_address', COALESCE(v_extracted_address, ''),
        'city_id', v_city_id,
        'region_id', v_region_id,
        'total_amount', 0,
        'delivery_fee', v_delivery_fee,
        'created_by', employee_id,
        'original_text', input_text
      ),
      'options_type', 'no_products'
    );
  END IF;
  
  RAISE NOTICE '✅ نتيجة المعالجة: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك، يرجى المحاولة مرة أخرى',
      'error', SQLERRM
    );
END;
$function$;