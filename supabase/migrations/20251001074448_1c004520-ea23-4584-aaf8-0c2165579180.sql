-- إصلاح استخراج المدينة والاسم والعنوان في process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_employee_name text;
  v_customer_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_customer_address text;
  v_customer_city text;
  v_city_id integer;
  v_region_id integer;
  v_product_items jsonb;
  v_total_amount numeric := 0;
  v_order_id uuid;
  v_has_unavailable boolean := false;
  v_alternatives_msg text := '';
  v_item jsonb;
  v_search_result record;
  v_region_result record;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام - الموظف: %, النص: %', p_employee_code, p_message_text;

  -- التحقق من وجود الموظف
  SELECT user_id, et.telegram_code
  INTO v_user_id, v_employee_name
  FROM employee_telegram_codes et
  WHERE et.telegram_code = p_employee_code 
    AND et.is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ الموظف غير موجود: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ رمز الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: %', v_user_id;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف: %', v_customer_phone;

  -- البحث عن اسم العميل في جدول customers بناءً على رقم الهاتف
  IF v_customer_phone IS NOT NULL AND v_customer_phone != 'غير محدد' THEN
    SELECT name INTO v_customer_name
    FROM customers
    WHERE phone = v_customer_phone
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_customer_name IS NULL THEN
      v_customer_name := 'زبون تليغرام';
    END IF;
  END IF;

  RAISE NOTICE '👤 اسم العميل: %', v_customer_name;

  -- استخراج المدينة باستخدام smart_search_city
  SELECT city_id, city_name INTO v_search_result
  FROM smart_search_city(p_message_text)
  WHERE confidence >= 0.7
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_search_result.city_id IS NOT NULL THEN
    v_city_id := v_search_result.city_id;
    v_customer_city := v_search_result.city_name;
    RAISE NOTICE '🏙️ المدينة: % (ID: %)', v_customer_city, v_city_id;

    -- محاولة استخراج المنطقة من regions_cache
    SELECT r.id, r.name INTO v_region_result
    FROM regions_cache r
    WHERE r.city_id = v_city_id
      AND r.is_active = true
      AND (
        lower(p_message_text) LIKE '%' || lower(r.name) || '%'
        OR lower(r.name) LIKE '%' || lower(SPLIT_PART(p_message_text, E'\n', 1)) || '%'
      )
    ORDER BY LENGTH(r.name) DESC
    LIMIT 1;

    IF v_region_result.id IS NOT NULL THEN
      v_region_id := v_region_result.id;
      v_customer_address := v_region_result.name;
      RAISE NOTICE '📍 المنطقة: % (ID: %)', v_customer_address, v_region_id;
    END IF;
  END IF;

  -- إذا لم يتم العثور على منطقة، استخدم extract_actual_address
  IF v_customer_address IS NULL THEN
    v_customer_address := extract_actual_address(p_message_text);
    RAISE NOTICE '📍 العنوان المستخرج: %', v_customer_address;
  END IF;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات: %', v_product_items;

  -- حساب المبلغ الإجمالي والتحقق من توفر المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    
    IF NOT COALESCE((v_item->>'is_available')::boolean, false) THEN
      v_has_unavailable := true;
      v_alternatives_msg := COALESCE(v_item->>'alternatives_message', '');
    END IF;
  END LOOP;

  RAISE NOTICE '💰 المبلغ الإجمالي للمنتجات: %', v_total_amount;

  -- إضافة رسوم التوصيل (5000 د.ع)
  v_total_amount := v_total_amount + 5000;

  RAISE NOTICE '💰 المبلغ النهائي مع رسوم التوصيل: %', v_total_amount;

  -- إذا كان هناك منتجات غير متوفرة، نرجع رسالة البدائل
  IF v_has_unavailable THEN
    RAISE NOTICE '⚠️ منتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg,
      'product_items', v_product_items
    );
  END IF;

  -- إنشاء طلب AI
  INSERT INTO ai_orders (
    customer_phone,
    customer_name,
    customer_address,
    customer_city,
    city_id,
    region_id,
    items,
    total_amount,
    status,
    source,
    created_by,
    telegram_chat_id,
    original_text,
    order_data
  ) VALUES (
    v_customer_phone,
    v_customer_name,
    v_customer_address,
    v_customer_city,
    v_city_id,
    v_region_id,
    v_product_items,
    v_total_amount,
    'pending',
    'telegram',
    v_user_id::text,
    p_telegram_chat_id,
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'chat_id', p_telegram_chat_id,
      'processed_at', now()
    )
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', '✅ تم إنشاء الطلب بنجاح',
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_name', v_customer_name,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'product_items', v_product_items,
    'total_amount', v_total_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة طلبك: ' || SQLERRM
    );
END;
$function$;