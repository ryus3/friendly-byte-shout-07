-- Fix extract_product_items_from_text call to use single parameter
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
  v_customer_id uuid;
  v_notes text;
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

  -- استخراج الملاحظات من النص
  v_notes := public.extract_order_notes(p_message_text);
  
  -- إذا كانت الملاحظات فارغة، نضع NULL
  IF v_notes IS NULL OR TRIM(v_notes) = '' THEN
    v_notes := NULL;
  END IF;

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
    -- إذا كانت الكلمة الأولى مدينة أو مرادف مدينة، استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
  ELSIF v_first_line IS NOT NULL AND v_first_line != '' THEN
    -- إذا لم تكن مدينة وغير فارغ، استخدمه كاسم الزبون
    v_customer_name := v_first_line;
  ELSE
    -- في حالة أخرى، استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
  END IF;

  RAISE NOTICE '📝 اسم الزبون المستخرج: %', v_customer_name;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);

  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);

  -- استخراج المنتجات من النص - FIXED: استخدام معامل واحد فقط
  v_product_items := extract_product_items_from_text(p_message_text);

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

  -- البحث عن العميل أو إنشاؤه
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = v_customer_phone
    AND created_by = v_employee_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, address, city, province, created_by)
    VALUES (v_customer_name, v_customer_phone, v_customer_address, p_city_name, p_region_name, v_employee_id)
    RETURNING id INTO v_customer_id;
  END IF;

  -- إنشاء سجل في جدول ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    items,
    total_amount,
    order_data,
    processed_by,
    city_id,
    region_id,
    delivery_fee,
    customer_name,
    customer_phone,
    customer_address,
    source,
    status,
    created_by,
    customer_city,
    customer_province,
    original_text,
    resolved_city_name,
    resolved_region_name,
    notes
  ) VALUES (
    p_telegram_chat_id,
    v_product_items,
    v_total_amount,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'message_text', p_message_text,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_name', v_customer_name,
      'customer_id', v_customer_id,
      'city_name', p_city_name,
      'region_name', p_region_name,
      'notes', v_notes
    ),
    v_employee_id,
    p_city_id,
    p_region_id,
    v_delivery_fee,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    'telegram',
    'pending',
    v_employee_id::text,
    p_city_name,
    p_region_name,
    v_original_text,
    p_city_name,
    p_region_name,
    v_notes
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI برقم: %', v_ai_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_ai_order_id,
    'customer_id', v_customer_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'notes', v_notes,
    'message', '✅ تم إنشاء الطلب بنجاح'
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