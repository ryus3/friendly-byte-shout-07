-- تعديل بسيط: إصلاح اسم الجدول في دالة process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_employee_code text;
  v_customer_phone text;
  v_customer_address text;
  v_product_items jsonb;
  v_result jsonb;
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_color record;
  v_size record;
  v_total_amount numeric := 0;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
BEGIN
  RAISE NOTICE '🔍 بدء معالجة الطلب - الرمز: %, النص: %', p_employee_code, p_message_text;
  
  -- الحصول على معرف الموظف من الرمز (الإصلاح: استخدام employee_telegram_codes)
  SELECT user_id, telegram_code INTO v_user_id, v_employee_code
  FROM employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على الموظف بالرمز: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رمز الموظف غير صحيح أو غير نشط: ' || p_employee_code
    );
  END IF;
  
  RAISE NOTICE '👤 رمز الموظف المستخدم: %', v_employee_code;
  RAISE NOTICE '👤 معرف الموظف المستخدم: %', v_user_id;
  
  -- استخراج رقم الهاتف
  v_customer_phone := extractPhoneFromText(p_message_text);
  
  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);
  
  RAISE NOTICE '🔄 معالجة الطلب باستخدام الدالة الذكية الصحيحة...';
  
  -- استخراج المنتجات مع تمرير معرف الموظف
  v_product_items := extract_product_items_from_text(p_message_text, v_user_id);
  
  RAISE NOTICE '✅ نتيجة معالجة الطلب: %', v_product_items;
  
  -- التحقق من وجود منتجات غير متوفرة
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF NOT (v_item->>'is_available')::boolean THEN
      v_has_unavailable := true;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', '');
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا كانت هناك منتجات غير متوفرة، نرجع رسالة الخطأ
  IF v_has_unavailable THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_alternatives_message
    );
  END IF;
  
  -- حساب المجموع الكلي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;
  
  -- إنشاء طلب AI
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    items,
    total_amount,
    source,
    status,
    created_by,
    telegram_chat_id,
    original_text,
    order_data
  ) VALUES (
    'زبون تليغرام',
    v_customer_phone,
    v_customer_address,
    v_product_items,
    v_total_amount,
    'telegram',
    'pending',
    v_user_id::text,
    p_telegram_chat_id,
    p_message_text,
    jsonb_build_object(
      'employee_code', v_employee_code,
      'chat_id', p_telegram_chat_id,
      'processed_at', now()
    )
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✅ تم إنشاء طلب AI برقم: %', v_order_id;
  
  -- إنشاء رسالة النجاح
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'message', '✅ تم استلام طلبك بنجاح!' || E'\n\n' ||
               '📱 الهاتف: ' || v_customer_phone || E'\n' ||
               '📍 العنوان: ' || v_customer_address || E'\n\n' ||
               '🛍️ المنتجات:' || E'\n',
    'items', v_product_items,
    'total_amount', v_total_amount
  );
  
  -- إضافة تفاصيل المنتجات للرسالة
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_result := jsonb_set(
      v_result,
      '{message}',
      to_jsonb((v_result->>'message')::text || 
        '• ' || (v_item->>'product_name')::text || 
        ' (' || (v_item->>'color')::text || ', ' || (v_item->>'size')::text || ') ' ||
        'x' || (v_item->>'quantity')::text || 
        ' = ' || (v_item->>'total_price')::text || ' IQD' || E'\n')
    );
  END LOOP;
  
  -- إضافة المجموع الكلي
  v_result := jsonb_set(
    v_result,
    '{message}',
    to_jsonb((v_result->>'message')::text || E'\n' ||
      '💰 المجموع الكلي: ' || v_total_amount::text || ' IQD' || E'\n\n' ||
      '✨ سيتم مراجعة طلبك وإشعارك بالتفاصيل قريباً')
  );
  
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