-- حذف جميع نسخ process_telegram_order المحتملة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid);
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, uuid);

-- إعادة إنشاء الدالة بالمنطق الجديد
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id bigint,
  p_message_text text,
  p_employee_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id uuid;
  v_customer_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_customer_city text;
  v_region_name text;
  v_product_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_final_amount numeric := 0;
  v_order_id uuid;
  v_ai_order_id uuid;
  v_alternatives_msg text := '';
  v_all_available boolean := true;
  v_item jsonb;
  v_default_customer_name text;
  v_customer_address text;
  extracted_name text;
  first_line text;
  remaining_text text;
  v_first_line_city text;
BEGIN
  RAISE NOTICE '📨 بدء معالجة طلب تليغرام - Chat ID: %, الرسالة: %', p_telegram_chat_id, p_message_text;

  -- 1. الحصول على معرف الموظف
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على موظف برمز: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز الموظف غير صحيح أو غير نشط',
      'error', 'invalid_employee_code'
    );
  END IF;

  RAISE NOTICE '👤 رمز الموظف المستخدم: %', p_employee_code;
  RAISE NOTICE '👤 معرف الموظف المستخدم: %', v_employee_id;

  -- 2. الحصول على الاسم الافتراضي من إعدادات الموظف
  SELECT settings->>'default_customer_name' INTO v_default_customer_name
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  v_default_customer_name := COALESCE(NULLIF(TRIM(v_default_customer_name), ''), 'زبون تليغرام');
  RAISE NOTICE '📝 الاسم الافتراضي المستخدم: %', v_default_customer_name;

  -- 3. استخراج السطر الأول
  first_line := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), '');
  RAISE NOTICE '📍 السطر الأول: %', first_line;

  -- 4. التحقق من وجود مدينة في السطر الأول
  IF first_line IS NOT NULL THEN
    SELECT city_name INTO v_first_line_city
    FROM smart_search_city(first_line)
    WHERE confidence >= 0.5
    ORDER BY confidence DESC
    LIMIT 1;
    
    RAISE NOTICE '🔍 نتيجة البحث عن مدينة في السطر الأول: %', v_first_line_city;
  END IF;

  -- 5. اتخاذ القرار بناءً على وجود المدينة
  IF v_first_line_city IS NOT NULL THEN
    -- السطر الأول يحتوي على مدينة = هذا عنوان
    v_customer_name := v_default_customer_name;
    v_region_name := first_line;
    v_customer_city := v_first_line_city;
    RAISE NOTICE '📍 السطر الأول عنوان (يحتوي على مدينة)، استخدام الاسم الافتراضي: %', v_customer_name;
  ELSE
    -- السطر الأول لا يحتوي على مدينة = قد يكون اسم
    extracted_name := first_line;
    
    -- تحقق من صحة الاسم
    IF extracted_name IS NOT NULL 
       AND LENGTH(extracted_name) >= 2 
       AND LENGTH(extracted_name) <= 50
       AND extracted_name !~ '[0-9]'
       AND extracted_name NOT ILIKE '%شارع%'
       AND extracted_name NOT ILIKE '%محلة%'
       AND extracted_name NOT ILIKE '%حي%'
       AND extracted_name NOT ILIKE '%07%' THEN
      v_customer_name := extracted_name;
      RAISE NOTICE '✅ تم استخراج الاسم من السطر الأول: %', v_customer_name;
      
      -- ابحث عن المدينة في باقي النص (بدون السطر الأول)
      remaining_text := NULLIF(TRIM(substring(p_message_text from position(E'\n' in p_message_text) + 1)), '');
      
      IF remaining_text IS NOT NULL THEN
        SELECT city_name INTO v_customer_city
        FROM smart_search_city(remaining_text)
        WHERE confidence >= 0.5
        ORDER BY confidence DESC
        LIMIT 1;
      END IF;
      
      -- إذا لم نجد مدينة في باقي النص، ابحث في النص الكامل
      IF v_customer_city IS NULL THEN
        SELECT city_name INTO v_customer_city
        FROM smart_search_city(p_message_text)
        WHERE confidence >= 0.5
        ORDER BY confidence DESC
        LIMIT 1;
      END IF;
      
      -- استخراج المنطقة من السطر الثاني
      v_region_name := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 2)), '');
      RAISE NOTICE '📍 المنطقة من السطر الثاني: %', v_region_name;
    ELSE
      -- اسم غير صالح، استخدم الاسم الافتراضي
      v_customer_name := v_default_customer_name;
      v_region_name := first_line;
      RAISE NOTICE '📝 اسم غير صالح (يحتوي على أرقام أو كلمات عنوان)، استخدام الاسم الافتراضي: %', v_customer_name;
      
      -- ابحث عن المدينة في النص الكامل
      SELECT city_name INTO v_customer_city
      FROM smart_search_city(p_message_text)
      WHERE confidence >= 0.5
      ORDER BY confidence DESC
      LIMIT 1;
    END IF;
  END IF;

  -- 6. استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_customer_phone;

  -- 7. استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '🛍️ المنتجات المستخرجة: %', v_product_items;

  -- 8. التحقق من توفر المنتجات وحساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = true THEN
      v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
    ELSE
      v_all_available := false;
      v_alternatives_msg := v_item->>'alternatives_message';
    END IF;
  END LOOP;

  v_final_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي: %, رسوم التوصيل: %, المبلغ النهائي: %', 
    v_total_amount, v_delivery_fee, v_final_amount;

  -- 9. إذا كانت جميع المنتجات متوفرة، قم بإنشاء الطلب
  IF v_all_available THEN
    -- بناء العنوان الكامل
    v_customer_address := COALESCE(v_region_name, '') || 
      CASE WHEN v_region_name IS NOT NULL AND v_region_name != '' THEN ', ' ELSE '' END ||
      COALESCE(v_region_name, '') || E'\n' ||
      COALESCE(p_message_text, '');
    
    -- إدراج ai_order
    INSERT INTO public.ai_orders (
      telegram_chat_id,
      customer_phone,
      customer_name,
      customer_city,
      customer_address,
      items,
      total_amount,
      status,
      created_by,
      original_text,
      order_data
    ) VALUES (
      p_telegram_chat_id,
      v_customer_phone,
      v_customer_name,
      COALESCE(v_customer_city, 'غير محدد'),
      v_customer_address,
      v_product_items,
      v_final_amount,
      'pending',
      v_employee_id::text,
      p_message_text,
      jsonb_build_object(
        'customer_name', v_customer_name,
        'customer_phone', v_customer_phone,
        'customer_city', COALESCE(v_customer_city, 'غير محدد'),
        'region', COALESCE(v_region_name, 'غير محدد'),
        'items', v_product_items,
        'total_amount', v_total_amount,
        'delivery_fee', v_delivery_fee,
        'final_amount', v_final_amount
      )
    ) RETURNING id INTO v_ai_order_id;

    RAISE NOTICE '✅ تم إنشاء ai_order بنجاح - ID: %', v_ai_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', format(
        E'✅ تم إنشاء الطلب بنجاح!\n👤 الزبون: %s\n📱 الهاتف: %s\n📍 المدينة: %s\n💰 المبلغ الإجمالي: %s دينار',
        v_customer_name,
        v_customer_phone,
        COALESCE(v_customer_city, 'غير محدد'),
        v_final_amount::text
      ),
      'order_id', v_order_id,
      'ai_order_id', v_ai_order_id,
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', COALESCE(v_customer_city, 'غير محدد'),
      'customer_address', v_customer_address,
      'total_amount', v_final_amount,
      'items', v_product_items,
      'extracted_data', jsonb_build_object(
        'customer_name', v_customer_name,
        'phone', v_customer_phone,
        'city', COALESCE(v_customer_city, 'غير محدد'),
        'region', COALESCE(v_region_name, 'غير محدد'),
        'items', v_product_items,
        'total_amount', v_total_amount,
        'delivery_fee', v_delivery_fee,
        'final_amount', v_final_amount
      )
    );
  ELSE
    -- إرجاع رسالة البدائل
    RAISE NOTICE '❌ بعض المنتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg,
      'items', v_product_items
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$$;