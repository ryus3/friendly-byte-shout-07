-- إصلاح استدعاء smart_search_region في process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(
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
  v_city_id integer;
  v_city_name text;
  v_city_confidence numeric;
  v_region_id integer;
  v_region_name text;
  v_region_confidence numeric;
  v_landmark text;
  v_extracted_phone text;
  v_extracted_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_final_amount numeric := 0;
  v_item jsonb;
  v_new_order_id uuid;
  v_employee_id uuid;
  v_alternatives_message text := '';
  v_all_available boolean := true;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام: %', p_message_text;

  -- التحقق من رمز الموظف إذا تم تقديمه
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_employee_id
    FROM public.telegram_employee_codes
    WHERE telegram_code = p_employee_code 
      AND is_active = true;
    
    IF v_employee_id IS NULL THEN
      RAISE NOTICE '⚠️ رمز موظف غير صحيح: %', p_employee_code;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'رمز الموظف غير صحيح أو غير نشط'
      );
    END IF;
  END IF;

  -- استخراج المدينة
  SELECT city_id, city_name, confidence
  INTO v_city_id, v_city_name, v_city_confidence
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_id IS NULL THEN
    v_city_name := 'غير محدد';
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة';
  ELSE
    RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %, الثقة: %)', v_city_name, v_city_id, v_city_confidence;
  END IF;

  -- استخراج المنطقة باستخدام city_id
  SELECT region_id, region_name, confidence
  INTO v_region_id, v_region_name, v_region_confidence
  FROM smart_search_region(p_message_text, v_city_id)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_region_id IS NULL THEN
    v_region_name := 'غير محدد';
    RAISE NOTICE '⚠️ لم يتم العثور على منطقة';
  ELSE
    RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %, الثقة: %)', v_region_name, v_region_id, v_region_confidence;
  END IF;

  -- استخراج العنوان التفصيلي
  v_landmark := extract_actual_address(p_message_text);
  RAISE NOTICE '🏠 العنوان: %', v_landmark;

  -- استخراج رقم الهاتف
  v_extracted_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف: %', v_extracted_phone;

  -- استخراج المنتجات
  v_extracted_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_extracted_items;

  -- التحقق من توفر المنتجات وحساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_extracted_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_all_available := false;
      v_alternatives_message := v_item->>'alternatives_message';
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إذا كانت المنتجات غير متوفرة، إرجاع رسالة البدائل
  IF NOT v_all_available THEN
    RAISE NOTICE '❌ منتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'error', v_alternatives_message,
      'unavailable_products', true
    );
  END IF;

  -- حساب المبلغ النهائي
  v_final_amount := v_total_amount + v_delivery_fee;

  -- إنشاء الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    city_id,
    region_id,
    items,
    total_amount,
    status,
    source,
    telegram_chat_id,
    created_by,
    original_text,
    order_data
  ) VALUES (
    'زبون تليغرام',
    v_extracted_phone,
    v_city_name,
    v_city_name,
    COALESCE(v_region_name, 'غير محدد') || COALESCE(' - ' || NULLIF(v_landmark, 'لم يُحدد'), ''),
    v_city_id,
    v_city_id,
    v_extracted_items,
    v_final_amount,
    'pending',
    'telegram',
    p_chat_id,
    COALESCE(v_employee_id::text, 'telegram_bot'),
    p_message_text,
    jsonb_build_object(
      'city_id', v_city_id,
      'city_name', v_city_name,
      'region_id', v_region_id,
      'region_name', v_region_name,
      'landmark', v_landmark,
      'phone', v_extracted_phone,
      'items', v_extracted_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_final_amount
    )
  ) RETURNING id INTO v_new_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI رقم: %', v_new_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_new_order_id,
    'city', v_city_name,
    'region', v_region_name,
    'address', v_landmark,
    'phone', v_extracted_phone,
    'items', v_extracted_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'final_amount', v_final_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة طلبك: ' || SQLERRM
    );
END;
$function$;