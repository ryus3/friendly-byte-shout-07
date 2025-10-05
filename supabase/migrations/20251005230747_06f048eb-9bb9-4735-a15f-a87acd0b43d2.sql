-- ✅ تحديث دالة process_telegram_order لإصلاح مشكلة استخراج المنتجات من سطر العنوان
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
  v_order_id uuid;
  v_customer_name text;
  v_default_customer_name text := 'زبون تليغرام';
  v_first_line text;
  v_is_city boolean := false;
  v_original_text text;
  v_lines text[];
  v_address_line text;
  v_product_text text;
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

  -- استخراج السطر الأول من النص
  v_first_line := TRIM(SPLIT_PART(p_message_text, E'\n', 1));

  -- فحص إذا كان السطر الأول يبدأ بمدينة
  SELECT EXISTS(
    SELECT 1 FROM public.cities_cache 
    WHERE LOWER(v_first_line) ILIKE LOWER(name) || '%'
       OR LOWER(v_first_line) ILIKE LOWER(name_ar) || '%'
       OR LOWER(v_first_line) ILIKE LOWER(name_en) || '%'
  ) INTO v_is_city;

  -- المنطق الذكي لتحديد اسم الزبون
  IF v_is_city THEN
    v_customer_name := v_default_customer_name;
  ELSIF v_first_line IS NOT NULL AND v_first_line != '' THEN
    v_customer_name := v_first_line;
  ELSE
    v_customer_name := v_default_customer_name;
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);

  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);

  -- ✅ إزالة سطر العنوان من النص قبل استخراج المنتجات
  v_lines := string_to_array(p_message_text, E'\n');
  v_product_text := '';
  
  -- البحث عن سطر العنوان (السطر الذي يحتوي على اسم المدينة)
  FOREACH v_address_line IN ARRAY v_lines
  LOOP
    -- تجاهل السطر إذا كان يحتوي على اسم المدينة أو رقم الهاتف
    IF LOWER(v_address_line) LIKE '%' || LOWER(p_city_name) || '%' 
       OR v_address_line ~ '[0-9]{11}' 
       OR v_address_line = v_first_line THEN
      CONTINUE;
    END IF;
    
    -- إضافة الأسطر الأخرى (المنتجات) للنص المُنظف
    IF v_product_text = '' THEN
      v_product_text := v_address_line;
    ELSE
      v_product_text := v_product_text || E'\n' || v_address_line;
    END IF;
  END LOOP;

  RAISE NOTICE '📦 النص المُنظف للمنتجات: %', v_product_text;

  -- استخراج المنتجات من النص المُنظف فقط (بدون سطر العنوان)
  v_product_items := extract_product_items_from_text(COALESCE(v_product_text, p_message_text));

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
    resolved_region_name
  ) VALUES (
    p_telegram_chat_id,
    v_product_items,
    v_total_amount,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'message_text', p_message_text,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address
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
    p_region_name
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI برقم: %', v_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'message', '✅ تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة الطلب'
    );
END;
$function$;