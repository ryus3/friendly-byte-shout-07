-- حذف النسخة القديمة من الدالة نهائياً
DROP FUNCTION IF EXISTS process_telegram_order(text, text, bigint);

-- تعديل الدالة لتقبل المعاملات التي يرسلها البوت وتُدخل في ai_orders
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id uuid;
  v_phone text;
  v_city_result jsonb;
  v_city_name text;
  v_region_name text;
  v_city_id integer;
  v_region_id integer;
  v_product_items jsonb;
  v_ai_order_id uuid;
  v_order_data jsonb;
  v_customer_name text := 'زبون تليغرام';
  v_address text;
BEGIN
  RAISE NOTICE '🔍 معالجة طلب من تليغرام: الموظف=% النص=%', p_employee_code, p_message_text;

  -- البحث عن الموظف
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '❌ رمز الموظف % غير موجود', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'رمز الموظف غير صحيح أو غير مفعّل'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: %', v_employee_id;

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_phone;

  -- البحث الذكي عن المدينة
  SELECT jsonb_build_object(
    'city_name', cc.name,
    'city_id', cc.id,
    'region_name', NULL,
    'region_id', NULL
  ) INTO v_city_result
  FROM smart_search_city(p_message_text) ss
  JOIN cities_cache cc ON ss.city_id = cc.id
  ORDER BY ss.confidence DESC
  LIMIT 1;

  IF v_city_result IS NOT NULL THEN
    v_city_name := v_city_result->>'city_name';
    v_city_id := (v_city_result->>'city_id')::integer;
    v_region_name := v_city_result->>'region_name';
    v_region_id := (v_city_result->>'region_id')::integer;
    RAISE NOTICE '🏙️ تم العثور على المدينة: %', v_city_name;
  ELSE
    v_city_name := 'لم يُحدد';
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة';
  END IF;

  -- استخراج العنوان
  v_address := extract_actual_address(p_message_text);
  RAISE NOTICE '📍 العنوان: %', v_address;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;

  -- حساب المبلغ الإجمالي
  DECLARE
    v_total_amount numeric := 0;
    v_item jsonb;
  BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
    LOOP
      v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    END LOOP;
  END;

  -- بناء order_data
  v_order_data := jsonb_build_object(
    'customer_phone', v_phone,
    'customer_name', v_customer_name,
    'customer_city', v_city_name,
    'customer_address', v_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'original_text', p_message_text
  );

  -- إدخال الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_phone,
    customer_name,
    customer_city,
    city_id,
    region_id,
    customer_address,
    items,
    total_amount,
    original_text,
    telegram_chat_id,
    created_by,
    source,
    status,
    order_data
  ) VALUES (
    v_phone,
    v_customer_name,
    v_city_name,
    v_city_id,
    v_region_id,
    v_address,
    v_product_items,
    v_total_amount,
    p_message_text,
    p_telegram_chat_id,
    v_employee_id::text,
    'telegram',
    'pending',
    v_order_data
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب ذكي: %', v_ai_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_id', v_employee_id,
    'customer_phone', v_phone,
    'customer_city', v_city_name,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'message', 'تم إنشاء الطلب الذكي بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', 'حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$$;