-- حذف الدالة القديمة وإنشائها من جديد بالتوقيع الصحيح
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, text);

CREATE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_chat_id bigint,
  p_employee_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_extracted_phone text;
  v_extracted_address text;
  v_extracted_items jsonb;
  v_city_id integer;
  v_city_name text;
  v_region_name text;
  v_landmark text;
  v_city_result record;
  v_region_result record;
  v_employee_id uuid;
  v_total_amount numeric := 0;
  v_final_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_alternatives_message text := '';
BEGIN
  RAISE NOTICE '🔄 بدء معالجة الطلب من التليغرام';
  RAISE NOTICE '📝 النص المستلم: %', p_message_text;

  -- البحث عن الموظف
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_employee_id
    FROM public.telegram_employee_codes
    WHERE telegram_code = p_employee_code 
      AND is_active = true
    LIMIT 1;
    
    RAISE NOTICE '👤 رمز الموظف المستخدم: %', p_employee_code;
    RAISE NOTICE '👤 معرف الموظف المستخدم: %', v_employee_id;
  END IF;

  -- 1. استخراج المدينة مع city_id
  SELECT city_id, city_name, confidence INTO v_city_result
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_result.city_name IS NOT NULL THEN
    v_city_id := v_city_result.city_id;
    v_city_name := v_city_result.city_name;
    RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_city_name, v_city_id;
  ELSE
    v_city_name := 'غير محدد';
    v_city_id := NULL;
    RAISE NOTICE '⚠️ لم يتم العثور على المدينة';
  END IF;

  -- 2. استخراج المنطقة باستخدام city_id
  IF v_city_id IS NOT NULL THEN
    SELECT region_name, confidence INTO v_region_result
    FROM smart_search_region(p_message_text, v_city_id::text)
    ORDER BY confidence DESC
    LIMIT 1;

    IF v_region_result.region_name IS NOT NULL THEN
      v_region_name := v_region_result.region_name;
      RAISE NOTICE '📍 تم العثور على المنطقة: %', v_region_name;
    ELSE
      v_region_name := 'غير محدد';
      RAISE NOTICE '⚠️ لم يتم العثور على المنطقة';
    END IF;
  ELSE
    v_region_name := 'غير محدد';
  END IF;

  -- 3. استخراج العلامة المميزة (landmark)
  v_landmark := extract_actual_address(p_message_text);
  IF v_landmark IS NULL OR v_landmark = '' THEN
    v_landmark := 'غير محدد';
  END IF;
  RAISE NOTICE '🏠 العلامة المميزة: %', v_landmark;

  -- 4. استخراج رقم الهاتف
  v_extracted_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 الهاتف المستخرج: %', v_extracted_phone;

  -- 5. استخراج المنتجات
  v_extracted_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_extracted_items;

  -- 6. حساب المبالغ
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_extracted_items) AS item;

  v_final_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي: %، المبلغ النهائي: %', v_total_amount, v_final_amount;

  -- 7. التحقق من توفر المنتجات
  SELECT string_agg(item->>'alternatives_message', E'\n\n')
  INTO v_alternatives_message
  FROM jsonb_array_elements(v_extracted_items) AS item
  WHERE (item->>'is_available')::boolean = false;

  -- 8. إنشاء السجل في ai_orders
  IF v_alternatives_message IS NULL OR v_alternatives_message = '' THEN
    INSERT INTO public.ai_orders (
      telegram_chat_id,
      customer_phone,
      customer_name,
      customer_city,
      region_id,
      customer_address,
      original_text,
      items,
      total_amount,
      status,
      source,
      created_by,
      order_data
    ) VALUES (
      p_chat_id,
      v_extracted_phone,
      'زبون تليغرام',
      v_city_name,
      v_city_id,
      v_landmark,
      p_message_text,
      v_extracted_items,
      v_total_amount,
      'pending',
      'telegram',
      v_employee_id,
      jsonb_build_object(
        'city', v_city_name,
        'city_id', v_city_id,
        'region', v_region_name,
        'landmark', v_landmark,
        'phone', v_extracted_phone,
        'items', v_extracted_items,
        'total_amount', v_total_amount,
        'delivery_fee', v_delivery_fee,
        'final_amount', v_final_amount
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'city', v_city_name,
      'city_id', v_city_id,
      'region', v_region_name,
      'landmark', v_landmark,
      'phone', v_extracted_phone,
      'items', v_extracted_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_final_amount,
      'message', '✅ تم استلام الطلب بنجاح'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_not_available',
      'message', v_alternatives_message,
      'city', v_city_name,
      'region', v_region_name,
      'phone', v_extracted_phone
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;