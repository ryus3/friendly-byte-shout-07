-- إصلاح منطق استخراج اسم الزبون في process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text, 
  p_message_text text, 
  p_telegram_chat_id bigint, 
  p_city_id integer DEFAULT NULL::integer, 
  p_region_id integer DEFAULT NULL::integer, 
  p_city_name text DEFAULT NULL::text, 
  p_region_name text DEFAULT NULL::text
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
  v_extracted_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_customer_name text;
  v_default_customer_name text;
  v_first_line text;
  v_normalized_first_line text;
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

  -- قراءة أجور التوصيل من الإعدادات
  SELECT (value::text)::numeric INTO v_delivery_fee
  FROM settings
  WHERE key = 'delivery_fee'
  LIMIT 1;
  
  v_delivery_fee := COALESCE(v_delivery_fee, 5000);

  -- استخراج المنتجات من النص
  SELECT extract_product_items_from_text(p_message_text) INTO v_extracted_items;
  
  -- حساب المبلغ الإجمالي مع أجور التوصيل
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0) + v_delivery_fee
  INTO v_total_amount
  FROM jsonb_array_elements(v_extracted_items) item;

  -- ✅ استخراج اسم الزبون من السطر الأول
  v_first_line := TRIM(SPLIT_PART(p_message_text, E'\n', 1));
  v_normalized_first_line := LOWER(TRIM(v_first_line));
  
  -- التحقق من أن السطر الأول ليس رقم هاتف أو مدينة أو منتج
  IF v_first_line IS NOT NULL 
     AND LENGTH(v_first_line) BETWEEN 2 AND 50
     AND v_normalized_first_line !~ '^07[0-9]{9}$'  -- ليس رقم هاتف
     AND v_normalized_first_line !~ '^[0-9+\s]+$'   -- ليس أرقام فقط
     AND NOT EXISTS (
       SELECT 1 FROM cities_cache WHERE LOWER(name) = v_normalized_first_line OR LOWER(name_ar) = v_normalized_first_line
     )
     AND NOT EXISTS (
       SELECT 1 FROM products WHERE LOWER(name) LIKE '%' || v_normalized_first_line || '%' LIMIT 1
     )
     AND NOT EXISTS (
       SELECT 1 FROM colors WHERE LOWER(name) = v_normalized_first_line
     )
     AND NOT EXISTS (
       SELECT 1 FROM sizes WHERE LOWER(name) = v_normalized_first_line
     )
  THEN
    v_customer_name := v_first_line;
  END IF;

  -- إذا لم يتم استخراج اسم، استخدم default_customer_name من profiles
  IF v_customer_name IS NULL OR v_customer_name = '' THEN
    SELECT default_customer_name INTO v_default_customer_name
    FROM profiles
    WHERE id = v_employee_id
    LIMIT 1;
    
    v_customer_name := COALESCE(NULLIF(TRIM(v_default_customer_name), ''), 'زبون تليغرام');
  END IF;

  -- ✅ إذا تم توفير city_id و region_id من نظام "هل تقصد؟"، استخدمهم مباشرة
  IF p_city_id IS NOT NULL AND p_region_id IS NOT NULL THEN
    v_city_id := p_city_id;
    v_region_id := p_region_id;
    v_city_name := COALESCE(p_city_name, 'غير محدد');
    v_region_name := COALESCE(p_region_name, 'غير محدد');
    v_location_confidence := 1.0;
    
    v_customer_city := v_city_name;
    v_customer_address := v_city_name || ' - ' || v_region_name;
    
    RAISE NOTICE '✅ استخدام معلومات من نظام "هل تقصد؟": المدينة=%, المنطقة=%', v_city_name, v_region_name;
  ELSE
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

  -- إنشاء سجل ai_order مع order_data والعناصر والمبلغ الإجمالي
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
    items,
    total_amount,
    delivery_fee,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    v_employee_id,
    p_message_text,
    v_customer_name,
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
    v_extracted_items,
    v_total_amount,
    v_delivery_fee,
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
      'employee_name', v_employee_name,
      'items', v_extracted_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee
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
    'items', v_extracted_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
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