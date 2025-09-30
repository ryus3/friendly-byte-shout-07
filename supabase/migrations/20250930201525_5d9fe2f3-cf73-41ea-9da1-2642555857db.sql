-- إعادة process_telegram_order لطريقة العمل الأصلية
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id bigint,
  p_message_text text,
  p_employee_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_customer_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_city_id integer;
  v_city_name text;
  v_region_name text;
  v_address text;
  v_product_items jsonb;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_created_by uuid;
  v_result jsonb;
  v_alternatives_msg text := '';
  v_all_available boolean := true;
BEGIN
  RAISE NOTICE '🔄 معالجة طلب تليغرام - Chat: %, النص: %', p_chat_id, p_message_text;

  -- الحصول على معرف الموظف من الكود
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_created_by
    FROM telegram_employee_codes
    WHERE telegram_code = p_employee_code
      AND is_active = true
    LIMIT 1;
    
    IF v_created_by IS NULL THEN
      RAISE NOTICE '⚠️ لم يتم العثور على موظف بالكود: %', p_employee_code;
    END IF;
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_customer_phone;

  -- البحث عن المدينة
  SELECT city_id, city_name INTO v_city_id, v_city_name
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_id IS NULL THEN
    v_city_name := 'غير محدد';
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة';
  ELSE
    RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_city_name, v_city_id;
  END IF;

  -- استخراج العنوان (يحتوي على المنطقة)
  v_address := extract_actual_address(p_message_text);
  RAISE NOTICE '📍 العنوان المستخرج: %', v_address;
  
  -- استخراج المنطقة من العنوان (الجزء الأول بعد الفاصلة أو المنطقة المذكورة)
  v_region_name := COALESCE(
    NULLIF(TRIM(SPLIT_PART(v_address, ',', 1)), ''),
    'غير محدد'
  );
  RAISE NOTICE '🗺️ المنطقة المستخرجة: %', v_region_name;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;

  -- حساب المبلغ الإجمالي والتحقق من التوفر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    
    IF NOT COALESCE((v_item->>'is_available')::boolean, false) THEN
      v_all_available := false;
      v_alternatives_msg := COALESCE(v_item->>'alternatives_message', '');
    END IF;
  END LOOP;

  RAISE NOTICE '💰 المبلغ الإجمالي: %, متوفر: %', v_total_amount, v_all_available;

  -- إذا كانت المنتجات غير متوفرة، إرجاع رسالة البدائل
  IF NOT v_all_available THEN
    RAISE NOTICE '❌ المنتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg,
      'show_alternatives', true
    );
  END IF;

  -- إنشاء الطلب
  INSERT INTO ai_orders (
    telegram_chat_id,
    customer_phone,
    customer_name,
    customer_city,
    customer_address,
    city_id,
    items,
    total_amount,
    original_text,
    created_by,
    source,
    status,
    order_data
  ) VALUES (
    p_chat_id,
    v_customer_phone,
    v_customer_name,
    v_city_name,
    v_address,
    v_city_id,
    v_product_items,
    v_total_amount,
    p_message_text,
    v_created_by,
    'telegram',
    'pending',
    jsonb_build_object(
      'region', v_region_name,
      'city_id', v_city_id,
      'city_name', v_city_name
    )
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب: %', v_order_id;

  -- بناء رسالة التأكيد
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_name', v_customer_name,
    'city', v_city_name,
    'region', v_region_name,
    'address', v_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'message', format(
      E'✅ تم إنشاء الطلب بنجاح!\n\n' ||
      '📱 الهاتف: %s\n' ||
      '👤 الاسم: %s\n' ||
      '🏙️ المدينة: %s\n' ||
      '🗺️ المنطقة: %s\n' ||
      '📍 العنوان: %s\n' ||
      '💰 المبلغ الإجمالي: %s دينار',
      v_customer_phone,
      v_customer_name,
      v_city_name,
      v_region_name,
      v_address,
      v_total_amount
    )
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
    );
END;
$function$;