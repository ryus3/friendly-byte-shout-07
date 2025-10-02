-- إرجاع دالة process_telegram_order للنسخة الصحيحة مع إضافة رسوم التوصيل
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_telegram_chat_id bigint,
  p_telegram_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_customer_name text := NULL;
  v_customer_phone text := NULL;
  v_customer_city text := NULL;
  v_customer_province text := 'العراق';
  v_customer_address text := NULL;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_lines text[];
  v_product_line text;
  v_first_line text;
  v_city_raw text;
  v_result jsonb;
  v_default_customer_name text;
  v_success_message text;
  v_item jsonb;
  v_item_product_name text;
  v_item_color text;
  v_item_size text;
  v_item_quantity integer;
BEGIN
  RAISE NOTICE '🔵 بدء معالجة طلب تليجرام - Chat ID: %, Username: %', p_telegram_chat_id, p_telegram_username;

  -- البحث عن الموظف المرتبط بهذا chat_id
  SELECT user_id INTO v_user_id
  FROM public.employee_telegram_codes
  WHERE telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على موظف مرتبط بـ chat_id: %', p_telegram_chat_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'telegram_not_linked',
      'message', '❌ حسابك على تليجرام غير مربوط بالنظام. يرجى التواصل مع المسؤول.'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: %', v_user_id;

  -- الحصول على اسم الزبون الافتراضي من profiles
  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  RAISE NOTICE '📝 الاسم الافتراضي من profiles: %', v_default_customer_name;

  -- قراءة رسوم التوصيل من settings
  SELECT COALESCE((value)::numeric, 5000) INTO v_delivery_fee
  FROM public.settings
  WHERE key = 'delivery_fee'
  LIMIT 1;

  RAISE NOTICE '💰 رسوم التوصيل: %', v_delivery_fee;

  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(p_message_text, E'\n');
  
  IF array_length(v_lines, 1) IS NULL OR array_length(v_lines, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'empty_message',
      'message', '❌ الرسالة فارغة'
    );
  END IF;

  -- السطر الأول: المدينة والمنطقة
  v_first_line := NULLIF(TRIM(v_lines[1]), '');
  
  -- التحقق إذا كان السطر الأول يحتوي على اسم مدينة عراقية
  IF v_first_line ~* '(بغداد|البصرة|اربيل|كركوك|النجف|كربلاء|السماوة|الديوانية|ميسان|ذي قار|واسط|بابل|صلاح الدين|الانبار|ديالى|نينوى|دهوك|سليمانية)' THEN
    v_city_raw := v_first_line;
    v_customer_name := COALESCE(v_default_customer_name, 'زبون تليجرام');
    RAISE NOTICE '🏙️ السطر الأول يحتوي على مدينة، استخدام الاسم الافتراضي: %', v_customer_name;
  ELSE
    -- السطر الأول هو اسم الزبون
    v_customer_name := v_first_line;
    v_city_raw := NULLIF(TRIM(v_lines[2]), '');
    RAISE NOTICE '👤 اسم الزبون: %', v_customer_name;
  END IF;

  -- استخراج رقم الهاتف من كامل النص
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_customer_phone;

  -- تحديد المدينة والمنطقة
  IF v_city_raw IS NOT NULL THEN
    -- محاولة البحث عن المدينة في قاعدة البيانات
    SELECT city_name INTO v_customer_city
    FROM smart_search_city(v_city_raw)
    ORDER BY confidence DESC
    LIMIT 1;

    IF v_customer_city IS NULL THEN
      v_customer_city := 'غير محدد';
    END IF;

    -- العنوان هو النص الكامل للمدينة والمنطقة
    v_customer_address := v_city_raw;
  ELSE
    v_customer_city := 'غير محدد';
    v_customer_address := 'غير محدد';
  END IF;

  RAISE NOTICE '🏙️ المدينة المستخرجة: %, العنوان: %', v_customer_city, v_customer_address;

  -- استخراج المنتجات (من السطر الثالث فصاعداً إذا كان السطر الأول اسم، أو من السطر الثاني إذا كان السطر الأول مدينة)
  IF v_first_line ~* '(بغداد|البصرة|اربيل|كركوك|النجف|كربلاء|السماوة|الديوانية|ميسان|ذي قار|واسط|بابل|صلاح الدين|الانبار|ديالى|نينوى|دهوك|سليمانية)' THEN
    v_product_line := array_to_string(v_lines[2:array_length(v_lines, 1)], E'\n');
  ELSE
    v_product_line := array_to_string(v_lines[3:array_length(v_lines, 1)], E'\n');
  END IF;
  
  IF NULLIF(TRIM(v_product_line), '') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_products',
      'message', '❌ لم يتم تحديد أي منتجات في الطلب'
    );
  END IF;

  RAISE NOTICE '📦 سطر المنتجات: %', v_product_line;

  -- استخراج المنتجات باستخدام الدالة الذكية
  v_items := extract_product_items_from_text(v_product_line);

  RAISE NOTICE '✅ المنتجات المستخرجة: %', v_items;

  -- حساب المبلغ الإجمالي من المنتجات
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item;

  RAISE NOTICE '💵 مبلغ المنتجات: %', v_total_amount;

  -- إضافة رسوم التوصيل للمبلغ الإجمالي
  v_total_amount := v_total_amount + v_delivery_fee;

  RAISE NOTICE '💰 المبلغ الإجمالي (مع التوصيل): %', v_total_amount;

  -- التحقق من توفر جميع المنتجات
  IF EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'is_available')::boolean = false
  ) THEN
    RAISE NOTICE '⚠️ بعض المنتجات غير متوفرة';
    
    -- إرجاع رسالة البدائل
    SELECT item->>'alternatives_message'
    INTO v_result
    FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'is_available')::boolean = false
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_not_available',
      'message', v_result,
      'items', v_items
    );
  END IF;

  -- حفظ الطلب في ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    created_by,
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    delivery_fee,
    total_amount,
    items,
    original_text,
    order_data,
    status,
    source
  ) VALUES (
    p_telegram_chat_id,
    p_telegram_username,
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_province,
    v_customer_address,
    v_delivery_fee,
    v_total_amount,
    v_items,
    p_message_text,
    jsonb_build_object(
      'telegram_username', p_telegram_username,
      'telegram_chat_id', p_telegram_chat_id,
      'employee_id', v_user_id,
      'processed_at', now()
    ),
    'pending',
    'telegram'
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم حفظ الطلب برقم: %', v_order_id;

  -- بناء رسالة النجاح مع عرض تفاصيل المنتجات
  v_success_message := '✅ تم استلام الطلب!' || E'\n\n' ||
    '🔹 ' || v_customer_name || E'\n' ||
    '📍 ' || v_customer_address || E'\n' ||
    '📱 الهاتف: ' || v_customer_phone || E'\n';

  -- إضافة تفاصيل كل منتج
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_item_product_name := v_item->>'product_name';
    v_item_color := v_item->>'color';
    v_item_size := v_item->>'size';
    v_item_quantity := (v_item->>'quantity')::integer;
    
    v_success_message := v_success_message || 
      '❇️ ' || v_item_product_name || 
      ' (' || v_item_color || ') ' || 
      v_item_size || ' × ' || v_item_quantity || E'\n';
  END LOOP;

  -- إضافة المبلغ الإجمالي
  v_success_message := v_success_message || 
    '💵 المبلغ الإجمالي: ' || v_total_amount::text || ' د.ع';

  -- إرجاع رسالة النجاح
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'message', v_success_message,
    'items', v_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
    );
END;
$$;