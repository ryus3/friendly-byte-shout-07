-- تعديل دالة process_telegram_order لإضافة أجور التوصيل للمبلغ الإجمالي
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_product_items jsonb;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_order_id uuid;
  v_success_message text := '';
  v_has_unavailable boolean := false;
  v_alternatives_msg text := '';
  v_product_line text;
BEGIN
  RAISE NOTICE '📨 معالجة طلب تليغرام من الموظف: %', p_employee_code;
  
  -- 1. البحث عن الموظف بالرمز
  SELECT etc.user_id, p.full_name 
  INTO v_employee_id, v_employee_name
  FROM public.employee_telegram_codes etc
  LEFT JOIN public.profiles p ON etc.user_id = p.id
  WHERE etc.telegram_code = p_employee_code
    AND etc.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '❌ رمز الموظف غير صحيح أو غير نشط: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ رمز الموظف غير صحيح أو غير نشط. الرجاء التواصل مع الإدارة.',
      'order_id', NULL
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: % (ID: %)', v_employee_name, v_employee_id;

  -- 2. قراءة أجور التوصيل من الإعدادات
  SELECT COALESCE((value)::numeric, 5000) INTO v_delivery_fee
  FROM public.settings
  WHERE key = 'delivery_fee'
  LIMIT 1;

  RAISE NOTICE '💵 أجور التوصيل من الإعدادات: %', v_delivery_fee;

  -- 3. استخراج المنتجات من النص
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;

  -- 4. حساب المبلغ الإجمالي والتحقق من التوفر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_msg := COALESCE(v_item->>'alternatives_message', '');
    END IF;
  END LOOP;

  -- 5. إضافة أجور التوصيل للمبلغ الإجمالي
  v_total_amount := v_total_amount + v_delivery_fee;
  
  RAISE NOTICE '💰 المبلغ الإجمالي (مع التوصيل): %', v_total_amount;

  -- 6. إذا كان هناك منتجات غير متوفرة، نرجع رسالة الخطأ فقط
  IF v_has_unavailable THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg,
      'order_id', NULL
    );
  END IF;

  -- 7. حفظ الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_phone,
    customer_address,
    customer_name,
    items,
    total_amount,
    delivery_fee,
    telegram_chat_id,
    original_text,
    order_data,
    status,
    created_by,
    source
  ) VALUES (
    'من تليغرام',
    'من تليغرام',
    COALESCE(v_employee_name, 'موظف تليغرام'),
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    p_telegram_chat_id,
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'employee_id', v_employee_id,
      'employee_name', v_employee_name,
      'message_text', p_message_text
    ),
    'pending',
    v_employee_id,
    'telegram'
  ) RETURNING id INTO v_order_id;

  -- 8. بناء رسالة النجاح
  v_success_message := '✅ تم استلام الطلب!' || E'\n\n';
  v_success_message := v_success_message || '🔹 ' || COALESCE(v_employee_name, 'موظف') || E'\n';
  v_success_message := v_success_message || '📍 بغداد - دورة' || E'\n';
  v_success_message := v_success_message || '📱 الهاتف: 07710666830' || E'\n';
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_product_line := '❇️ ' || (v_item->>'product_name') || 
                     ' (' || (v_item->>'color') || ') ' || 
                     (v_item->>'size') || 
                     ' × ' || (v_item->>'quantity');
    v_success_message := v_success_message || v_product_line || E'\n';
  END LOOP;
  
  v_success_message := v_success_message || E'💵 المبلغ الإجمالي: ' || 
                      trim(to_char(v_total_amount, 'FM999,999')) || ' د.ع';

  RETURN jsonb_build_object(
    'success', true,
    'message', v_success_message,
    'order_id', v_order_id,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة طلبك. الرجاء المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$function$;