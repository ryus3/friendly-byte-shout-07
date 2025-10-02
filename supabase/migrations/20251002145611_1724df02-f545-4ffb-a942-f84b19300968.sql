-- إرجاع دالة process_telegram_order للإصدار الصحيح من 12:13 مع إضافة رسوم التوصيل
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_employee_code text;
  v_items jsonb;
  v_phone text;
  v_customer_name text;
  v_default_customer_name text;
  v_line1 text;
  v_line2 text;
  v_has_city_in_line1 boolean := false;
  v_city_raw text;
  v_city_name text;
  v_region_name text;
  v_city_region_array text[];
  v_address text;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_item jsonb;
  v_success_message text;
  v_alternatives_msg text := '';
  v_has_unavailable boolean := false;
BEGIN
  -- 1. البحث عن user_id من employee_telegram_codes
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

  -- 2. قراءة الاسم الافتراضي من جدول profiles بدلاً من auth.users
  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  v_default_customer_name := COALESCE(NULLIF(trim(v_default_customer_name), ''), 'زبون تليغرام');

  -- 3. استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  
  IF v_phone IS NULL OR v_phone = '' OR v_phone = 'غير محدد' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم العثور على رقم هاتف صحيح في الرسالة'
    );
  END IF;

  -- 4. قراءة السطر الأول والثاني
  v_line1 := COALESCE(NULLIF(trim(split_part(p_message_text, E'\n', 1)), ''), '');
  v_line2 := COALESCE(NULLIF(trim(split_part(p_message_text, E'\n', 2)), ''), '');

  -- 5. التحقق من وجود مدينة حقيقية في السطر الأول
  IF v_line1 != '' THEN
    SELECT EXISTS(
      SELECT 1 FROM cities_cache 
      WHERE is_active = true 
      AND (
        lower(name) = lower(v_line1) 
        OR lower(v_line1) LIKE '%' || lower(name) || '%'
        OR lower(name) LIKE '%' || lower(v_line1) || '%'
      )
    ) INTO v_has_city_in_line1;
  END IF;

  -- 6. تحديد الاسم والعنوان بناءً على وجود المدينة
  IF v_has_city_in_line1 THEN
    -- السطر الأول يحتوي على مدينة = عنوان، استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
    v_city_raw := v_line1;
  ELSIF v_line1 != '' THEN
    -- السطر الأول = اسم (إذا كان موجود)، السطر الثاني = عنوان
    v_customer_name := v_line1;
    v_city_raw := COALESCE(NULLIF(v_line2, ''), 'غير محدد');
  ELSE
    -- السطر الأول فارغ = استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
    v_city_raw := COALESCE(NULLIF(v_line2, ''), 'غير محدد');
  END IF;

  -- 7. تقسيم المدينة والمنطقة بشكل ذكي
  v_city_region_array := regexp_split_to_array(v_city_raw, '\s+');
  
  IF array_length(v_city_region_array, 1) >= 2 THEN
    v_city_name := v_city_region_array[1];
    v_region_name := v_city_region_array[2];
    v_city_raw := v_city_name || ' - ' || v_region_name;
  END IF;

  -- 8. استخراج العنوان التفصيلي
  v_address := extract_actual_address(p_message_text);

  -- 9. استخراج المنتجات
  v_items := extract_product_items_from_text(p_message_text);
  
  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الرسالة'
    );
  END IF;

  -- 10. فحص توفر المنتجات وحساب المبلغ الإجمالي
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

  -- 10.5. قراءة وإضافة رسوم التوصيل
  SELECT COALESCE((value)::numeric, 5000) INTO v_delivery_fee
  FROM public.settings
  WHERE key = 'delivery_fee'
  LIMIT 1;
  
  v_total_amount := v_total_amount + v_delivery_fee;

  -- 11. إدراج الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    items,
    total_amount,
    delivery_fee,
    status,
    source,
    telegram_chat_id,
    created_by,
    original_text,
    order_data
  ) VALUES (
    v_customer_name,
    v_phone,
    v_city_raw,
    v_address,
    v_items,
    v_total_amount,
    v_delivery_fee,
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

  -- 12. بناء رسالة النجاح بالصيغة المطلوبة
  v_success_message := '✅ تم استلام الطلب!' || E'\n\n' ||
    '🔹 ' || v_customer_name || E'\n' ||
    '📍 ' || v_city_raw || E'\n' ||
    '📱 الهاتف: ' || v_phone || E'\n';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_success_message := v_success_message || 
      '❇️ ' || (v_item->>'product_name') || 
      ' (' || (v_item->>'color') || ') ' || (v_item->>'size') ||
      ' × ' || (v_item->>'quantity') || E'\n';
  END LOOP;

  v_success_message := v_success_message || 
    '💵 المبلغ الإجمالي: ' || 
    trim(to_char(v_total_amount, 'FM999,999')) || ' د.ع';

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