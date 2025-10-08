-- إصلاح process_telegram_order لاستخدام ai_orders بدلاً من orders

DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text, 
  p_message_text text, 
  p_telegram_chat_id bigint, 
  p_city_id integer, 
  p_region_id integer, 
  p_city_name text, 
  p_region_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_product_items jsonb;
  v_customer_phone text;
  v_customer_address text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_ai_order_id uuid;
  v_customer_name text;
  v_default_customer_name text := 'زبون تليغرام';
  v_first_line text;
  v_first_word text;
  v_is_city boolean := false;
  v_original_text text;
  v_notes text := NULL;
  v_lines text[];
  v_line text;
  v_customer_id uuid;
BEGIN
  -- التحقق من وجود الموظف
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', '❌ رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- الحصول على اسم الزبون الافتراضي من ملف المستخدم
  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_employee_id;
  
  v_default_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');

  -- حفظ النص الأصلي قبل المعالجة
  v_original_text := p_message_text;

  -- استخراج الملاحظات من السطر الذي يبدأ بـ "ملاحظة" أو "ملاحظه"
  v_lines := string_to_array(p_message_text, E'\n');
  
  FOREACH v_line IN ARRAY v_lines LOOP
    IF v_line ~* '^\s*(ملاحظة|ملاحظه)\s*:?\s*' THEN
      v_notes := TRIM(regexp_replace(v_line, '^\s*(ملاحظة|ملاحظه)\s*:?\s*', '', 'i'));
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '📝 الملاحظات المستخرجة: %', COALESCE(v_notes, 'لا توجد');

  -- استخراج السطر الأول من النص
  v_first_line := TRIM(SPLIT_PART(p_message_text, E'\n', 1));

  -- استخراج الكلمة الأولى فقط من السطر الأول
  v_first_word := TRIM(SPLIT_PART(v_first_line, ' ', 1));

  -- فحص إذا كانت الكلمة الأولى مدينة في cities_cache
  SELECT EXISTS(
    SELECT 1 FROM public.cities_cache 
    WHERE LOWER(v_first_word) = LOWER(name)
       OR LOWER(v_first_word) = LOWER(name_ar)
       OR LOWER(v_first_word) = LOWER(name_en)
  ) INTO v_is_city;

  -- إذا لم نجدها في cities_cache، نفحص city_aliases
  IF NOT v_is_city THEN
    SELECT EXISTS(
      SELECT 1 FROM public.city_aliases
      WHERE LOWER(v_first_word) = LOWER(alias_name)
    ) INTO v_is_city;
  END IF;

  -- المنطق الذكي لتحديد اسم الزبون
  IF v_is_city THEN
    v_customer_name := v_default_customer_name;
  ELSIF v_first_line IS NOT NULL AND v_first_line != '' THEN
    v_customer_name := v_first_line;
  ELSE
    v_customer_name := v_default_customer_name;
  END IF;

  RAISE NOTICE '📝 اسم الزبون المستخرج: %', v_customer_name;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);

  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);

  -- استخراج المنتجات من النص
  v_product_items := extract_product_items_from_text(p_message_text, v_employee_id);

  -- التحقق من وجود منتجات غير متوفرة
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_product_items) item
    WHERE (item->>'is_available')::boolean = false
  ) THEN
    DECLARE
      v_alternatives_message text;
    BEGIN
      SELECT item->>'alternatives_message' INTO v_alternatives_message
      FROM jsonb_array_elements(v_product_items) item
      WHERE (item->>'is_available')::boolean = false
      LIMIT 1;

      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', v_alternatives_message,
        'alternatives', v_product_items
      );
    END;
  END IF;

  -- حساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
  END LOOP;

  -- إنشاء عميل جديد أو البحث عن عميل موجود
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = v_customer_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, address, city, province, created_by)
    VALUES (v_customer_name, v_customer_phone, v_customer_address, p_city_name, p_city_name, v_employee_id)
    RETURNING id INTO v_customer_id;
  END IF;

  -- إنشاء الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    delivery_fee,
    items,
    order_data,
    source,
    status,
    created_by,
    telegram_chat_id,
    original_text,
    notes,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    p_city_name,
    p_city_name,
    v_total_amount,
    v_delivery_fee,
    v_product_items,
    jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'city', p_city_name,
      'region', p_region_name,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_amount + v_delivery_fee,
      'items', v_product_items,
      'notes', v_notes
    ),
    'telegram',
    'pending',
    v_employee_id,
    p_telegram_chat_id,
    v_original_text,
    v_notes,
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'message', '✅ تم إنشاء الطلب الذكي بنجاح',
    'order_details', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'city', p_city_name,
      'region', p_region_name,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_amount + v_delivery_fee,
      'items', v_product_items,
      'notes', v_notes
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;