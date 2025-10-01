-- الحل الجذري: حذف جميع النسخ وإنشاء دالة واحدة مدمجة

-- 1️⃣ حذف جميع نسخ process_telegram_order
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid);
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, uuid);

-- 2️⃣ إنشاء نسخة واحدة مدمجة تجمع أفضل ميزات النسختين
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id bigint,
  p_message_text text,
  p_telegram_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_name text := 'زبون تليغرام';
  v_customer_phone text;
  v_customer_city text;
  v_customer_address text;
  v_product_items jsonb;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_ai_order_id uuid;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
  v_region_name text := NULL;
  v_default_customer_name text;
BEGIN
  RAISE NOTICE '🔄 معالجة الطلب من تليغرام...';
  RAISE NOTICE '📨 النص: %', p_message_text;
  RAISE NOTICE '👤 Chat ID: %, Username: %', p_telegram_chat_id, p_telegram_username;

  -- الحصول على معرف الموظف من chat_id
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;
  
  RAISE NOTICE '👤 معرف الموظف: %', v_employee_id;

  -- محاولة الحصول على الاسم الافتراضي من profiles
  IF v_employee_id IS NOT NULL THEN
    SELECT default_customer_name INTO v_default_customer_name
    FROM public.profiles
    WHERE id = v_employee_id;
  END IF;

  -- استخراج الاسم بذكاء من النص
  DECLARE
    name_pattern text;
    extracted_name text;
    first_line text;
  BEGIN
    -- أخذ السطر الأول فقط
    first_line := SPLIT_PART(p_message_text, E'\n', 1);
    
    -- إزالة المسافات الزائدة
    first_line := TRIM(regexp_replace(first_line, '\s+', ' ', 'g'));
    
    -- نمط الاسم العربي: كلمتين أو ثلاث كلمات عربية متتالية في بداية السطر
    extracted_name := substring(first_line from '^([\u0600-\u06FF\s]{2,50})');
    extracted_name := TRIM(extracted_name);
    
    -- التحقق من صحة الاسم
    IF extracted_name IS NOT NULL 
       AND LENGTH(extracted_name) >= 4 
       AND LENGTH(extracted_name) <= 50
       AND extracted_name !~ '[0-9]'
       AND extracted_name NOT ILIKE '%مدينة%'
       AND extracted_name NOT ILIKE '%شارع%'
       AND extracted_name NOT ILIKE '%محلة%'
       AND extracted_name NOT ILIKE '%حي%' THEN
      v_customer_name := extracted_name;
      RAISE NOTICE '✅ تم استخراج الاسم: %', v_customer_name;
    ELSE
      -- استخدام الاسم الافتراضي من الـ profile إن وجد
      v_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');
      RAISE NOTICE '📝 استخدام الاسم الافتراضي: %', v_customer_name;
    END IF;
  END;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف: %', v_customer_phone;

  -- استخراج اسم المدينة
  WITH city_matches AS (
    SELECT city_id, city_name, confidence
    FROM smart_search_city(p_message_text)
    ORDER BY confidence DESC
    LIMIT 1
  )
  SELECT city_name INTO v_customer_city
  FROM city_matches;
  
  RAISE NOTICE '🏙️ المدينة: %', v_customer_city;

  -- استخراج المنطقة من السطر الأول
  v_region_name := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), '');
  IF v_region_name IS NULL OR v_region_name = '' THEN
    v_region_name := 'غير محدد';
  END IF;
  RAISE NOTICE '📍 المنطقة: %', v_region_name;

  -- استخراج العنوان الفعلي
  v_customer_address := extract_actual_address(p_message_text);
  IF v_customer_address IS NULL OR v_customer_address = '' THEN
    v_customer_address := v_region_name;
  ELSE
    v_customer_address := v_region_name || ', ' || v_customer_address;
  END IF;

  -- استخراج عناصر المنتج
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '🛍️ المنتجات المستخرجة: %', v_product_items;

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

  -- إذا كان هناك منتجات غير متوفرة، إرجاع رسالة الخطأ
  IF v_has_unavailable THEN
    RAISE NOTICE '❌ منتج غير متوفر: %', v_alternatives_message;
    
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'error', 'product_unavailable'
    );
  END IF;

  -- إنشاء الطلب في ai_orders للمراجعة
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
    p_telegram_chat_id,
    v_customer_name,
    v_customer_phone,
    COALESCE(v_customer_city, 'غير محدد'),
    v_customer_address,
    v_product_items,
    v_total_amount + v_delivery_fee,
    p_message_text,
    'pending',
    'telegram',
    COALESCE(v_employee_id::text, 'telegram'),
    jsonb_build_object(
      'chat_id', p_telegram_chat_id,
      'username', p_telegram_username,
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', v_customer_city,
      'region', v_region_name,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_amount + v_delivery_fee,
      'extracted_data', jsonb_build_object(
        'city', v_customer_city,
        'region', v_region_name,
        'phone', v_customer_phone,
        'items', v_product_items
      )
    )
  )
  RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء AI Order بنجاح - ID: %', v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      '✅ تم إنشاء الطلب بنجاح!' || E'\n' ||
      '👤 الزبون: %s' || E'\n' ||
      '📱 الهاتف: %s' || E'\n' ||
      '📍 المدينة: %s' || E'\n' ||
      '💰 المبلغ الإجمالي: %.2f دينار',
      v_customer_name,
      COALESCE(v_customer_phone, 'غير محدد'),
      COALESCE(v_customer_city, 'غير محدد'),
      v_total_amount + v_delivery_fee
    ),
    'ai_order_id', v_ai_order_id,
    'order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount + v_delivery_fee,
    'extracted_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'phone', v_customer_phone,
      'city', v_customer_city,
      'region', v_region_name,
      'delivery_fee', v_delivery_fee,
      'total_amount', v_total_amount,
      'final_amount', v_total_amount + v_delivery_fee,
      'items', v_product_items
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: %', SQLERRM;
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$function$;