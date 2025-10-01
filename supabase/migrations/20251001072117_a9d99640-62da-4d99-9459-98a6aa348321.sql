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
  v_employee_name text;
  v_customer_phone text;
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

  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);
  RAISE NOTICE '📍 العنوان: %', v_customer_address;

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

  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;

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
    'زبون تليغرام',
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