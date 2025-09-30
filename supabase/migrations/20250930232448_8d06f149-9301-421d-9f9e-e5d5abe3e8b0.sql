-- إرجاع دالة process_telegram_order للنسخة الصحيحة الكاملة مع default_customer_name
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, text);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id bigint,
  p_message_text text,
  p_employee_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_employee_id uuid;
  v_default_customer_name text := NULL;
  v_customer_city text := NULL;
  v_region_name text := NULL;
  v_customer_phone text := NULL;
  v_customer_address text := NULL;
  v_product_items jsonb := '[]'::jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_order_id uuid;
  v_item jsonb;
  v_is_available boolean := true;
  v_alternatives_message text := '';
  v_city_id integer;
BEGIN
  -- البحث عن الموظف باستخدام رمز التليغرام
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    SELECT user_id INTO v_employee_id
    FROM public.telegram_employee_codes
    WHERE telegram_code = p_employee_code AND is_active = true
    LIMIT 1;
  END IF;

  IF v_employee_id IS NULL THEN
    v_employee_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  END IF;

  RAISE NOTICE '👤 معرف الموظف المستخدم: %', v_employee_id;
  RAISE NOTICE '👤 رمز الموظف المستخدم: %', p_employee_code;

  -- جلب الاسم الافتراضي من الإعدادات
  IF v_employee_id IS NOT NULL THEN
    SELECT default_customer_name INTO v_default_customer_name
    FROM public.profiles
    WHERE user_id = v_employee_id;
  END IF;

  -- استخراج المنطقة من السطر الأول
  v_region_name := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), '');
  IF v_region_name IS NULL OR v_region_name = '' THEN
    v_region_name := 'غير محدد';
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  
  -- البحث الذكي عن المدينة
  SELECT city_name INTO v_customer_city
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;
  
  IF v_customer_city IS NULL THEN
    v_customer_city := 'غير محدد';
  END IF;

  -- الحصول على معرف المدينة
  SELECT id INTO v_city_id
  FROM public.cities_cache
  WHERE LOWER(name) = LOWER(v_customer_city)
  LIMIT 1;
  
  -- استخراج العنوان الفعلي
  v_customer_address := extract_actual_address(p_message_text);
  
  -- بناء العنوان الكامل مع المنطقة
  IF v_customer_address IS NULL OR v_customer_address = '' OR v_customer_address = 'لم يُحدد' THEN
    v_customer_address := v_region_name;
  ELSE
    v_customer_address := v_region_name || ', ' || v_customer_address;
  END IF;
  
  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);

  -- التحقق من توفر المنتجات وحساب الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF NOT COALESCE((v_item->>'is_available')::boolean, false) THEN
      v_is_available := false;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', 'المنتج غير متوفر');
      EXIT;
    END IF;
    
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إذا كانت المنتجات غير متوفرة، إرجاع رسالة البدائل
  IF NOT v_is_available THEN
    RAISE NOTICE '⚠️ منتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'customer_phone', v_customer_phone,
      'customer_city', v_customer_city,
      'customer_address', v_customer_address,
      'items', v_product_items,
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'items', v_product_items
      )
    );
  END IF;

  -- إنشاء الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    total_amount,
    status,
    created_by,
    telegram_chat_id,
    items,
    order_data,
    original_text,
    city_id
  ) VALUES (
    COALESCE(NULLIF(TRIM(v_default_customer_name), ''), 'زبون تليغرام'),
    v_customer_phone,
    v_customer_city,
    v_customer_address,
    v_total_amount + v_delivery_fee,
    'pending',
    v_employee_id::text,
    p_chat_id,
    v_product_items,
    jsonb_build_object(
      'city', v_customer_city,
      'region', v_region_name,
      'phone', v_customer_phone,
      'address', v_customer_address,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_amount + v_delivery_fee
    ),
    p_message_text,
    v_city_id
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ نتيجة معالجة الطلب: %', jsonb_build_object(
    'order_id', v_order_id,
    'customer_city', v_customer_city,
    'customer_phone', v_customer_phone,
    'total_amount', v_total_amount + v_delivery_fee,
    'items', v_product_items
  );

  -- إرجاع النتيجة مع extracted_data الكامل
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم استلام طلبك بنجاح! سيتم التواصل معك قريباً.',
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount + v_delivery_fee,
    'extracted_data', jsonb_build_object(
      'city', v_customer_city,
      'region', v_region_name,
      'phone', v_customer_phone,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_amount + v_delivery_fee
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. الرجاء المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$$;