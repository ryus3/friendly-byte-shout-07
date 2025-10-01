-- حذف الدالة الحالية ذات المعاملين
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text);

-- إعادة إنشاء الدالة الصحيحة بـ 3 معاملات كما كانت تعمل
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_employee_code text;
  v_items jsonb;
  v_phone text;
  v_customer_name text;
  v_city_name text;
  v_address text;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_success_message text;
  v_alternatives_msg text := '';
  v_has_unavailable boolean := false;
BEGIN
  -- 1. البحث عن user_id من employee_telegram_codes باستخدام chat_id
  SELECT user_id, telegram_code INTO v_user_id, v_employee_code
  FROM public.employee_telegram_codes
  WHERE telegram_chat_id = p_telegram_chat_id AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ هذا الحساب غير مرتبط بأي موظف. يرجى التواصل مع الإدارة.'
    );
  END IF;

  -- استخدام employee_code من الجدول
  v_employee_code := COALESCE(v_employee_code, p_employee_code);

  -- 2. استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  
  IF v_phone IS NULL OR v_phone = '' OR v_phone = 'غير محدد' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم العثور على رقم هاتف صحيح في الرسالة'
    );
  END IF;

  -- 3. استخراج اسم الزبون
  v_customer_name := COALESCE(NULLIF(trim(split_part(p_message_text, E'\n', 1)), ''), 'زبون تليغرام');

  -- 4. استخراج المنتجات
  v_items := extract_product_items_from_text(p_message_text);
  
  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الرسالة'
    );
  END IF;

  -- 5. فحص توفر المنتجات وحساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF NOT COALESCE((v_item->>'is_available')::boolean, false) THEN
      v_has_unavailable := true;
      v_alternatives_msg := COALESCE(v_item->>'alternatives_message', '');
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إذا كان هناك منتجات غير متوفرة
  IF v_has_unavailable THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg
    );
  END IF;

  -- 6. استخراج المدينة والعنوان
  v_city_name := COALESCE(NULLIF(trim(split_part(p_message_text, E'\n', 3)), ''), 'غير محدد');
  v_address := extract_actual_address(p_message_text);

  -- 7. إدراج الطلب في ai_orders مع created_by كـ UUID نصي
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
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
    v_phone,
    v_city_name,
    v_address,
    v_items,
    v_total_amount,
    'pending',
    'telegram',
    p_telegram_chat_id,
    v_user_id::text,
    p_message_text,
    jsonb_build_object(
      'employee_id', v_user_id,
      'employee_code', v_employee_code,
      'chat_id', p_telegram_chat_id,
      'processed_at', now()
    )
  );

  -- 8. بناء رسالة النجاح
  v_success_message := '✅ تم استلام الطلب!' || E'\n\n' ||
    '👤 الزبون: ' || v_customer_name || E'\n' ||
    '📱 الهاتف: ' || v_phone || E'\n' ||
    '🏙 المدينة: ' || v_city_name || E'\n' ||
    '📍 العنوان: ' || v_address || E'\n\n' ||
    '📦 المنتجات:' || E'\n';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_success_message := v_success_message || 
      '• ' || (v_item->>'product_name') || 
      ' (' || (v_item->>'color') || ', ' || (v_item->>'size') || ')' ||
      ' × ' || (v_item->>'quantity') || E'\n';
  END LOOP;

  v_success_message := v_success_message || E'\n' ||
    '💰 المبلغ الإجمالي: ' || v_total_amount || ' دينار';

  RETURN jsonb_build_object(
    'success', true,
    'message', v_success_message
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة طلب تليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.'
    );
END;
$function$;