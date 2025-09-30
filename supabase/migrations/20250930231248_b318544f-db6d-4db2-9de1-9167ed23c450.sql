-- إرجاع دالة process_telegram_order للنسخة الصحيحة مع إضافة default_customer_name
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
  v_city_name text;
  v_city_id integer;
  v_phone text;
  v_address text;
  v_items jsonb;
  v_total_amount numeric := 0;
  v_final_amount numeric := 0;
  v_order_id uuid;
  v_order_data jsonb;
  v_item jsonb;
  v_is_available boolean := true;
  v_alternatives_message text := '';
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

  -- استخراج رقم الهاتف
  v_phone := public.extractPhoneFromText(p_message_text);
  
  -- البحث الذكي عن المدينة
  SELECT city_name INTO v_city_name
  FROM public.smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;
  
  -- الحصول على معرف المدينة
  SELECT id INTO v_city_id
  FROM public.cities_cache
  WHERE LOWER(name) = LOWER(v_city_name)
  LIMIT 1;
  
  -- استخراج العنوان
  v_address := public.extract_actual_address(p_message_text);
  
  -- استخراج المنتجات
  v_items := public.extract_product_items_from_text(p_message_text);

  -- فحص توفر المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_is_available := false;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', '');
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إذا كانت المنتجات غير متوفرة
  IF NOT v_is_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'items', v_items
    );
  END IF;

  v_final_amount := v_total_amount;

  -- إنشاء الطلب في ai_orders مع استخدام الاسم الافتراضي
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
    v_phone,
    v_city_name,
    v_address,
    v_total_amount,
    'pending',
    v_employee_id::text,
    p_chat_id,
    v_items,
    jsonb_build_object(
      'phone', v_phone,
      'city', v_city_name,
      'address', v_address,
      'items', v_items
    ),
    p_message_text,
    v_city_id
  )
  RETURNING id INTO v_order_id;

  -- بناء بيانات الطلب
  v_order_data := jsonb_build_object(
    'success', true,
    'message', 'تم استلام طلبك بنجاح! سيتم التواصل معك قريباً.',
    'order_id', v_order_id,
    'customer_phone', v_phone,
    'customer_city', v_city_name,
    'customer_address', v_address,
    'total_amount', v_total_amount,
    'items', v_items
  );

  RAISE NOTICE '✅ تم معالجة الطلب بنجاح: %', v_order_data;

  RETURN v_order_data;

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