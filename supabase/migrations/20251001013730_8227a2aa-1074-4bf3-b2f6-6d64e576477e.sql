-- تعديل دالة process_telegram_order لاستخراج ذكي للاسم والعنوان
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text, 
  p_message_text text, 
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_default_customer_name text := 'زبون تليغرام';
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_city_id integer;
  v_region_id integer;
  v_products jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_ai_order_id uuid;
  v_lines text[];
  v_line text;
  v_first_line text;
  v_address_line text;
  v_city_found boolean := false;
  v_name_from_text text;
  v_result jsonb;
  v_city_record record;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام - كود الموظف: %, النص: %', p_employee_code, p_message_text;

  -- 1. العثور على user_id من employee_code
  SELECT user_id INTO v_user_id
  FROM telegram_employee_codes
  WHERE employee_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ كود الموظف غير صحيح: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على المستخدم: %', v_user_id;

  -- 2. قراءة default_customer_name من profiles
  SELECT COALESCE(NULLIF(TRIM(default_customer_name), ''), 'زبون تليغرام')
  INTO v_default_customer_name
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  RAISE NOTICE '📝 الاسم الافتراضي من الإعدادات: %', v_default_customer_name;

  -- 3. تقسيم النص إلى أسطر
  v_lines := string_to_array(p_message_text, E'\n');
  v_first_line := COALESCE(NULLIF(TRIM(v_lines[1]), ''), '');

  -- 4. استخراج الاسم الذكي من السطر الأول
  -- إذا السطر الأول لا يبدأ بمدينة ولا يحتوي أرقام، يعتبر اسم
  IF v_first_line != '' THEN
    -- التحقق من أن السطر الأول ليس مدينة
    SELECT COUNT(*) > 0 INTO v_city_found
    FROM cities_cache cc
    WHERE cc.is_active = true
      AND (
        lower(v_first_line) LIKE lower(cc.name) || '%'
        OR lower(v_first_line) LIKE '%' || lower(cc.name) || '%'
      );
    
    -- إذا لم يكن مدينة ولا يحتوي أرقام، يعتبر اسم
    IF NOT v_city_found AND v_first_line !~ '[0-9]' AND length(v_first_line) > 2 AND length(v_first_line) < 50 THEN
      v_name_from_text := v_first_line;
      RAISE NOTICE '✅ تم استخراج الاسم من السطر الأول: %', v_name_from_text;
    END IF;
  END IF;

  -- استخدام الاسم المستخرج أو الافتراضي
  v_customer_name := COALESCE(v_name_from_text, v_default_customer_name);
  RAISE NOTICE '👤 الاسم النهائي: %', v_customer_name;

  -- 5. استخراج العنوان الذكي - البحث عن السطر الذي يبدأ بمدينة
  FOREACH v_line IN ARRAY v_lines
  LOOP
    IF TRIM(v_line) = '' THEN CONTINUE; END IF;
    
    -- البحث عن مدينة في بداية السطر
    SELECT cc.id, cc.name INTO v_city_record
    FROM cities_cache cc
    WHERE cc.is_active = true
      AND (
        lower(TRIM(v_line)) LIKE lower(cc.name) || '%'
        OR lower(TRIM(v_line)) LIKE lower(cc.name) || ' %'
      )
    ORDER BY length(cc.name) DESC
    LIMIT 1;
    
    IF v_city_record.id IS NOT NULL THEN
      v_city_id := v_city_record.id;
      v_customer_city := v_city_record.name;
      v_address_line := TRIM(v_line);
      
      -- استخراج المنطقة من السطر (ما بعد المدينة)
      v_customer_address := TRIM(regexp_replace(v_address_line, '^' || v_customer_city || '\s*-?\s*', '', 'i'));
      
      -- إذا كان العنوان فارغ بعد إزالة المدينة، استخدم السطر كامل
      IF v_customer_address = '' OR v_customer_address = v_customer_city THEN
        v_customer_address := v_address_line;
      END IF;
      
      RAISE NOTICE '🏙️ المدينة: % (ID: %), العنوان: %', v_customer_city, v_city_id, v_customer_address;
      EXIT; -- خروج من الحلقة بعد إيجاد المدينة
    END IF;
  END LOOP;

  -- إذا لم نجد مدينة، استخدم العنوان الكامل
  IF v_city_id IS NULL THEN
    v_customer_address := p_message_text;
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة، استخدام النص الكامل كعنوان';
  END IF;

  -- 6. استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_customer_phone;

  -- 7. استخراج المنتجات
  v_products := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_products;

  -- 8. حساب المبلغ الإجمالي (مع رسوم التوصيل)
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_products) AS item;

  v_total_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي مع التوصيل: %', v_total_amount;

  -- 9. إنشاء ai_order في جدول ai_orders
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    city_id,
    region_id,
    items,
    total_amount,
    status,
    source,
    telegram_chat_id,
    created_by,
    original_text,
    order_data
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_city_id,
    v_region_id,
    v_products,
    v_total_amount,
    'pending',
    'telegram',
    p_telegram_chat_id,
    v_user_id::text,
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'delivery_fee', v_delivery_fee
    )
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء AI Order: %', v_ai_order_id;

  -- 10. إرجاع البيانات الكاملة
  v_result := jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'extracted_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_city', v_customer_city,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'products', v_products,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'created_by', v_user_id
    )
  );

  RAISE NOTICE '✅ نجح إنشاء الطلب الذكي';
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;