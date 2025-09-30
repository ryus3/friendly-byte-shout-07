-- Fix total_amount in process_telegram_order to include delivery fee
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_chat_id bigint, p_message_text text, p_employee_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_phone text;
  v_customer_city text;
  v_customer_address text;
  v_product_items jsonb;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_order_id uuid;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
  v_region_name text := NULL;
  v_delivery_fee numeric := 5000;
BEGIN
  RAISE NOTICE '🔄 معالجة الطلب باستخدام الدالة الصحيحة...';
  RAISE NOTICE '📨 تحديث تليغرام: %', jsonb_build_object('chat_id', p_chat_id, 'text', p_message_text, 'employee_code', p_employee_code);

  -- الحصول على معرف الموظف من رمزه
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_employee_id
    FROM public.telegram_employee_codes
    WHERE employee_code = p_employee_code
      AND is_active = true
    LIMIT 1;
    
    RAISE NOTICE '👤 معرف الموظف المستخدم: %', v_employee_id;
    RAISE NOTICE '👤 رمز الموظف المستخدم: %', p_employee_code;
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);

  -- استخراج اسم المدينة
  WITH city_matches AS (
    SELECT city_id, city_name, confidence
    FROM smart_search_city(p_message_text)
    ORDER BY confidence DESC
    LIMIT 1
  )
  SELECT city_name INTO v_customer_city
  FROM city_matches;

  -- استخراج المنطقة من النص مباشرة
  v_region_name := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), '');
  IF v_region_name IS NULL OR v_region_name = '' THEN
    v_region_name := 'غير محدد';
  END IF;

  -- استخراج العنوان الفعلي
  v_customer_address := extract_actual_address(p_message_text);
  IF v_customer_address IS NULL OR v_customer_address = '' THEN
    v_customer_address := v_region_name;
  ELSE
    v_customer_address := v_region_name || ', ' || v_customer_address;
  END IF;

  -- استخراج عناصر المنتج
  v_product_items := extract_product_items_from_text(p_message_text);

  -- حساب المبلغ الإجمالي والتحقق من التوافر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_message := v_item->>'alternatives_message';
      EXIT;
    END IF;
    v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
  END LOOP;

  -- إذا كان هناك منتجات غير متوفرة، إرجاع رسالة الخطأ مع extracted_data
  IF v_has_unavailable THEN
    RAISE NOTICE '✅ نتيجة معالجة الطلب: %', jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'error', 'product_unavailable',
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'items', v_product_items,
        'total_amount', v_total_amount
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'error', 'product_unavailable',
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'items', v_product_items,
        'total_amount', v_total_amount
      )
    );
  END IF;

  -- إنشاء الطلب في ai_orders مع order_data
  -- ✅ FIX: total_amount الآن يشمل رسوم التوصيل
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    items,
    total_amount,
    original_text,
    status,
    source,
    created_by,
    order_data
  ) VALUES (
    p_chat_id,
    'زبون تليغرام',
    v_customer_phone,
    COALESCE(v_customer_city, 'غير محدد'),
    v_customer_address,
    v_product_items,
    v_total_amount + v_delivery_fee,  -- ✅ الآن يشمل رسوم التوصيل
    p_message_text,
    'pending',
    'telegram',
    COALESCE(v_employee_id::text, 'telegram'),
    jsonb_build_object(
      'chat_id', p_chat_id,
      'delivery_fee', v_delivery_fee,
      'delivery_partner', 'alwaseet',
      'employee_code', p_employee_code,
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'address_line_used', p_message_text,
        'products', v_product_items
      ),
      'source', 'telegram',
      'total_amount', v_total_amount
    )
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ نتيجة معالجة الطلب: %', jsonb_build_object(
    'success', true,
    'message', 'تم استلام طلبك بنجاح! سيتم التواصل معك قريباً.',
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'extracted_data', jsonb_build_object(
      'city', v_customer_city,
      'region', v_region_name,
      'phone', v_customer_phone,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'final_amount', v_total_amount + v_delivery_fee
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم استلام طلبك بنجاح! سيتم التواصل معك قريباً.',
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'extracted_data', jsonb_build_object(
      'city', v_customer_city,
      'region', v_region_name,
      'phone', v_customer_phone,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'final_amount', v_total_amount + v_delivery_fee
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✅ نتيجة معالجة الطلب: %', jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
      'error', SQLERRM,
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'items', v_product_items,
        'total_amount', v_total_amount
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
      'error', SQLERRM,
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'items', v_product_items,
        'total_amount', v_total_amount
      )
    );
END;
$function$;