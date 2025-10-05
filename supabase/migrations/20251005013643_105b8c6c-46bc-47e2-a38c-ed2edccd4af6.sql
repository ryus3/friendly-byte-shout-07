-- إصلاح نهائي: إضافة order_data المفقود لدالة process_telegram_order
-- المشكلة: order_data هو عمود NOT NULL لكن الدالة لا تدرج قيمة له

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_region_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_ai_order_id uuid;
  v_city_id integer;
  v_region_id integer;
  v_city_name text;
  v_region_name text;
  v_location_confidence numeric := 0;
  v_customer_city text;
  v_customer_address text;
BEGIN
  -- البحث عن الموظف
  SELECT user_id INTO v_employee_id
  FROM telegram_employee_codes
  WHERE employee_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- الحصول على اسم الموظف
  SELECT email INTO v_employee_name
  FROM auth.users
  WHERE id = v_employee_id;

  -- ✅ إذا تم توفير city_id و region_id من نظام "هل تقصد؟"، استخدمهم مباشرة
  IF p_city_id IS NOT NULL AND p_region_id IS NOT NULL THEN
    v_city_id := p_city_id;
    v_region_id := p_region_id;
    v_city_name := COALESCE(p_city_name, 'غير محدد');
    v_region_name := COALESCE(p_region_name, 'غير محدد');
    v_location_confidence := 1.0;
    
    -- بناء customer_city من المدينة والمنطقة
    v_customer_city := v_city_name;
    v_customer_address := v_city_name || ' - ' || v_region_name;
    
    RAISE NOTICE '✅ استخدام معلومات من نظام "هل تقصد؟": المدينة=%, المنطقة=%', v_city_name, v_region_name;
  ELSE
    -- ❌ استخدام smart_search_city التقليدي (للحالات القديمة فقط)
    DECLARE
      v_city_result jsonb;
    BEGIN
      SELECT smart_search_city(p_message_text) INTO v_city_result;
      
      v_city_id := (v_city_result->>'city_id')::integer;
      v_city_name := v_city_result->>'city_name';
      v_location_confidence := COALESCE((v_city_result->>'confidence')::numeric, 0);
      v_customer_city := v_city_name;
      v_customer_address := p_message_text;
      
      RAISE NOTICE '⚠️ استخدام smart_search_city التقليدي: المدينة=%', v_city_name;
    END;
  END IF;

  -- إنشاء سجل ai_order مع order_data
  INSERT INTO ai_orders (
    telegram_chat_id,
    processed_by,
    original_text,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    source,
    status,
    created_by,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    location_confidence,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    v_employee_id,
    p_message_text,
    COALESCE(v_employee_name, 'زبون تليغرام'),
    extractphonefromtext(p_message_text),
    v_customer_city,
    v_customer_address,
    'telegram',
    'pending',
    v_employee_id,
    v_city_id,
    v_region_id,
    v_city_name,
    v_region_name,
    v_location_confidence,
    jsonb_build_object(
      'city_id', v_city_id,
      'region_id', v_region_id,
      'city_name', v_city_name,
      'region_name', v_region_name,
      'location_confidence', v_location_confidence,
      'customer_city', v_customer_city,
      'customer_address', v_customer_address,
      'customer_phone', extractphonefromtext(p_message_text),
      'original_text', p_message_text,
      'employee_id', v_employee_id,
      'employee_name', v_employee_name
    )
  )
  RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_id', v_employee_id,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'city_name', v_city_name,
    'region_name', v_region_name,
    'message', '✅ تم حفظ الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في process_telegram_order: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;