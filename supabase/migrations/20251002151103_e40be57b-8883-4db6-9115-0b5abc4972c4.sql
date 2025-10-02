-- Fix process_telegram_order function to correctly use smart_search_city
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_chat_id bigint,
  p_telegram_user_id bigint DEFAULT NULL,
  p_telegram_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_customer_phone text := NULL;
  v_customer_address text := NULL;
  v_customer_city text := NULL;
  v_customer_province text := NULL;
  v_items jsonb := '[]'::jsonb;
  v_total_amount numeric := 0;
  v_order_id uuid;
  v_employee record;
  v_alternatives_found boolean := false;
  v_alternatives_message text := '';
  v_item jsonb;
  v_phone_found boolean := false;
  v_address_found boolean := false;
  v_city_found boolean := false;
  v_items_found boolean := false;
  v_delivery_fee numeric := 5000;
  v_original_text text;
  v_region_id integer := NULL;
  v_city_id integer := NULL;
  v_city_confidence numeric := 0;
  v_phone_raw text := NULL;
  v_address_raw text := NULL;
  v_city_raw text := NULL;
  v_items_raw text := NULL;
BEGIN
  v_original_text := p_message_text;
  v_lines := string_to_array(p_message_text, E'\n');

  -- البحث عن الموظف المرتبط
  SELECT * INTO v_employee
  FROM public.telegram_employee_codes
  WHERE telegram_chat_id = p_chat_id
    AND is_active = true
  LIMIT 1;

  IF v_employee.user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'لم يتم العثور على حساب مرتبط بهذا الحساب'
    );
  END IF;

  -- استخراج رقم الهاتف
  FOREACH v_line IN ARRAY v_lines
  LOOP
    v_customer_phone := extractphonefromtext(v_line);
    IF v_customer_phone IS NOT NULL AND v_customer_phone != 'غير محدد' THEN
      v_phone_found := true;
      v_phone_raw := v_line;
      EXIT;
    END IF;
  END LOOP;

  -- استخراج المدينة باستخدام smart_search_city
  FOREACH v_line IN ARRAY v_lines
  LOOP
    -- تجاهل الأسطر الفارغة وأسطر الهاتف
    IF trim(v_line) = '' OR v_line = v_phone_raw THEN
      CONTINUE;
    END IF;

    -- البحث عن المدينة
    SELECT city_id, city_name, confidence 
    INTO v_city_id, v_customer_city, v_city_confidence
    FROM smart_search_city(trim(v_line))
    ORDER BY confidence DESC
    LIMIT 1;

    -- إذا وجدنا مدينة بثقة عالية
    IF v_city_id IS NOT NULL AND v_city_confidence >= 0.7 THEN
      v_city_found := true;
      v_city_raw := v_line;
      EXIT;
    END IF;
  END LOOP;

  -- إذا لم نجد مدينة، نستخدم أول سطر غير فارغ وغير رقم هاتف
  IF NOT v_city_found THEN
    FOREACH v_line IN ARRAY v_lines
    LOOP
      IF trim(v_line) != '' AND v_line != v_phone_raw THEN
        v_city_raw := v_line;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- استخراج العنوان (السطر الذي يحتوي على المدينة أو أول سطر بعد الهاتف)
  IF v_city_raw IS NOT NULL THEN
    v_customer_address := v_city_raw;
    v_address_found := true;
  ELSE
    FOREACH v_line IN ARRAY v_lines
    LOOP
      IF v_line != v_phone_raw AND trim(v_line) != '' THEN
        v_customer_address := v_line;
        v_address_found := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- استخراج المنتجات من الرسالة الكاملة
  v_items := extract_product_items_from_text(p_message_text);

  -- التحقق من البدائل
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_alternatives_found := true;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', '');
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  v_items_found := jsonb_array_length(v_items) > 0;

  -- إذا كانت هناك بدائل، نرجع رسالة الخطأ
  IF v_alternatives_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'has_alternatives', true,
      'alternatives_message', v_alternatives_message,
      'items', v_items
    );
  END IF;

  -- إنشاء سجل في ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    items,
    total_amount,
    delivery_fee,
    order_data,
    status,
    created_by,
    original_text,
    city_id,
    region_id,
    resolved_city_name,
    location_confidence
  ) VALUES (
    p_chat_id,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_items,
    v_total_amount,
    v_delivery_fee,
    jsonb_build_object(
      'phone_found', v_phone_found,
      'address_found', v_address_found,
      'city_found', v_city_found,
      'items_found', v_items_found,
      'phone_raw', v_phone_raw,
      'address_raw', v_address_raw,
      'city_raw', v_city_raw,
      'items_raw', v_items_raw
    ),
    'pending',
    v_employee.user_id,
    v_original_text,
    v_city_id,
    v_region_id,
    v_customer_city,
    v_city_confidence
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'customer_city', v_customer_city,
    'items', v_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'employee_id', v_employee.user_id,
    'city_detected', v_city_found,
    'city_id', v_city_id,
    'city_confidence', v_city_confidence
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة طلب تليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة الطلب',
      'details', SQLERRM
    );
END;
$function$;