-- Replace with the comprehensive, correct process_telegram_order function
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text DEFAULT 'EMP0001',
  p_chat_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ai_order_id uuid;
  v_user_id uuid;
  v_customer_phone text;
  v_customer_name text;
  v_customer_city text;
  v_customer_address text;
  v_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_final_amount numeric := 0;
  v_city_result record;
  v_region_result record;
  v_found_city text := 'غير محدد';
  v_found_region text := 'غير محدد';
  v_landmark text := '';
  v_city_id integer;
  v_region_id integer;
  v_address_lines text[];
  v_clean_address text;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام بالكود: %', p_employee_code;
  
  -- استخراج البيانات من الـ JSON
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_name := p_order_data->>'customer_name';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_address := p_order_data->>'customer_address';
  v_items := p_order_data->'items';
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);
  
  -- حساب المبلغ النهائي مع رسوم التوصيل
  v_final_amount := v_total_amount + v_delivery_fee;
  
  -- البحث عن المستخدم بالكود
  SELECT tc.user_id INTO v_user_id
  FROM public.telegram_employee_codes tc
  WHERE tc.employee_code = p_employee_code
    AND tc.is_active = true
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على موظف بالكود: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مربوط'
    );
  END IF;
  
  RAISE NOTICE '✅ تم العثور على الموظف: %', v_user_id;
  
  -- معالجة العنوان متعدد الأسطر
  v_clean_address := TRIM(REGEXP_REPLACE(v_customer_address, E'[\\r\\n]+', ' ', 'g'));
  v_address_lines := string_to_array(v_customer_address, E'\n');
  
  -- البحث الذكي عن المدينة
  IF v_customer_city IS NOT NULL AND v_customer_city != '' THEN
    -- البحث في cache المدن
    SELECT city_id, city_name, confidence INTO v_city_result
    FROM smart_search_city(v_customer_city)
    ORDER BY confidence DESC
    LIMIT 1;
    
    IF v_city_result.city_id IS NOT NULL THEN
      v_found_city := v_city_result.city_name;
      v_city_id := v_city_result.city_id;
      RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city, v_city_id;
    ELSE
      v_found_city := v_customer_city;
      RAISE NOTICE '⚠️ لم يتم العثور على المدينة في الكاش: %', v_customer_city;
    END IF;
  END IF;
  
  -- البحث الذكي عن المنطقة
  IF array_length(v_address_lines, 1) > 0 THEN
    -- محاولة استخراج المنطقة من السطر الأول
    SELECT region_id, region_name, match_type, confidence INTO v_region_result
    FROM smart_search_region(v_address_lines[1], v_city_id)
    ORDER BY confidence DESC
    LIMIT 1;
    
    IF v_region_result.region_id IS NOT NULL THEN
      v_found_region := v_region_result.region_name;
      v_region_id := v_region_result.region_id;
      RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region, v_region_id;
    ELSE
      -- محاولة استخراج المنطقة من الكلمات
      IF v_clean_address ~* '(الملحق|المركز|الحي|منطقة)' THEN
        v_found_region := TRIM(SUBSTRING(v_clean_address FROM '(?:كربلاء\s+)?(\w+)'));
        IF v_found_region = '' OR v_found_region = v_found_city THEN
          v_found_region := 'غير محدد';
        END IF;
      END IF;
      RAISE NOTICE '⚠️ لم يتم العثور على المنطقة في الكاش، استخدام: %', v_found_region;
    END IF;
  END IF;
  
  -- استخراج أقرب نقطة دالة (landmark)
  v_landmark := extract_actual_address(v_clean_address);
  IF v_landmark = 'لم يُحدد' OR v_landmark = '' THEN
    -- محاولة استخراج الشارع أو النقطة المرجعية
    IF v_clean_address ~* 'شارع' THEN
      v_landmark := TRIM(SUBSTRING(v_clean_address FROM '(شارع[^\\n]*?)(?:\\n|$)'));
    ELSIF array_length(v_address_lines, 1) > 1 THEN
      v_landmark := TRIM(v_address_lines[2]);
      -- إزالة رقم الهاتف إذا كان موجود
      IF v_landmark ~ '^07[0-9]{9}$' THEN
        v_landmark := COALESCE(TRIM(v_address_lines[3]), 'غير محدد');
      END IF;
    END IF;
  END IF;
  
  -- إنشاء الطلب الذكي
  INSERT INTO public.ai_orders (
    customer_phone,
    customer_name,
    customer_city,
    customer_address,
    city_id,
    region_id,
    items,
    total_amount,
    order_data,
    telegram_chat_id,
    status,
    created_by,
    source
  ) VALUES (
    v_customer_phone,
    v_customer_name,
    v_found_city,
    v_clean_address,
    v_city_id,
    v_region_id,
    v_items,
    v_final_amount,
    p_order_data,
    p_chat_id,
    'pending',
    v_user_id, -- إصلاح: استخدام معرف المستخدم الفعلي بدلاً من 'telegram'
    'telegram'
  )
  RETURNING id INTO v_ai_order_id;
  
  RAISE NOTICE '✅ تم إنشاء الطلب الذكي: %', v_ai_order_id;
  
  -- إرجاع النتيجة الكاملة مع جميع البيانات المطلوبة
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'user_id', v_user_id,
    'customer_city', v_found_city,
    'customer_region', v_found_region,
    'customer_phone', v_customer_phone,
    'customer_address', v_clean_address,
    'landmark', v_landmark,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'items', v_items,
    'final_amount', v_final_amount,
    'delivery_fee', v_delivery_fee,
    'message', format('تم حفظ الطلب بنجاح - المدينة: %s، المنطقة: %s، العنوان: %s', 
      v_found_city, v_found_region, COALESCE(NULLIF(v_landmark, ''), 'غير محدد'))
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة طلبك'
    );
END;
$function$;