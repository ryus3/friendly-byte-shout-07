-- إصلاح دالة process_telegram_order لإدخال في ai_orders بدلاً من orders
DROP FUNCTION IF EXISTS process_telegram_order(text, text, uuid);

CREATE OR REPLACE FUNCTION process_telegram_order(
  p_order_text text,
  p_telegram_chat_id text,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_city_search_result record;
  v_city_id integer;
  v_city_name text;
  v_region_id integer;
  v_address text;
  v_product_items jsonb;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_ai_order_id uuid;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
BEGIN
  RAISE NOTICE '📞 بدء معالجة طلب تليغرام من chat_id: %', p_telegram_chat_id;
  RAISE NOTICE '📝 نص الطلب: %', p_order_text;
  RAISE NOTICE '👤 معرف الموظف: %', p_employee_id;

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_order_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_phone;

  -- البحث عن المدينة بثقة منخفضة (0.5)
  SELECT city_id, city_name, confidence 
  INTO v_city_search_result
  FROM smart_search_city(p_order_text)
  WHERE confidence >= 0.5
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_search_result.city_id IS NOT NULL THEN
    v_city_id := v_city_search_result.city_id;
    v_city_name := v_city_search_result.city_name;
    RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %, ثقة: %)', v_city_name, v_city_id, v_city_search_result.confidence;
  ELSE
    v_city_name := 'غير محدد';
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة';
  END IF;

  -- استخراج العنوان (المنطقة فقط)
  v_address := extract_actual_address(p_order_text);
  RAISE NOTICE '📍 العنوان المستخرج: %', v_address;

  -- البحث عن المنطقة
  IF v_city_id IS NOT NULL THEN
    SELECT id INTO v_region_id
    FROM regions_cache
    WHERE city_id = v_city_id
      AND (
        lower(name) LIKE '%' || lower(v_address) || '%'
        OR lower(v_address) LIKE '%' || lower(name) || '%'
      )
    LIMIT 1;
    
    IF v_region_id IS NOT NULL THEN
      RAISE NOTICE '🗺️ تم العثور على المنطقة ID: %', v_region_id;
    END IF;
  END IF;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_order_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;

  -- حساب المبلغ الإجمالي والتحقق من التوافر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      IF v_alternatives_message = '' THEN
        v_alternatives_message := v_item->>'alternatives_message';
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;
  RAISE NOTICE '❌ يوجد منتجات غير متوفرة: %', v_has_unavailable;

  -- إذا كان هناك منتجات غير متوفرة، نرجع رسالة الخطأ
  IF v_has_unavailable THEN
    RAISE NOTICE '⚠️ إرجاع رسالة البدائل للمستخدم';
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'customer_name', v_customer_name,
      'customer_phone', v_phone,
      'customer_city', v_city_name,
      'product_items', v_product_items
    );
  END IF;

  -- إدخال الطلب في ai_orders
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    region_id,
    items,
    total_amount,
    source,
    status,
    telegram_chat_id,
    created_by,
    original_text,
    order_data
  ) VALUES (
    v_customer_name,
    v_phone,
    v_city_name,
    v_address,
    v_city_id,
    v_region_id,
    v_product_items,
    v_total_amount,
    'telegram',
    'pending',
    p_telegram_chat_id::bigint,
    p_employee_id,
    p_order_text,
    jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_phone,
      'customer_city', v_city_name,
      'customer_address', v_address,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'total_amount', v_total_amount
    )
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب ذكي بنجاح - ID: %', v_ai_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'message', '✅ تم إنشاء الطلب بنجاح',
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_phone,
    'customer_city', v_city_name,
    'customer_address', v_address,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'total_amount', v_total_amount,
    'product_items', v_product_items
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % - %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;