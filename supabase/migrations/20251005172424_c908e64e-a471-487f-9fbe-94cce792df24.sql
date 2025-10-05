-- تعديل دالة process_telegram_order لإضافة منطق استخراج اسم الزبون الذكي
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_items jsonb,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_address text DEFAULT NULL,
  p_telegram_chat_id bigint DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 5000,
  p_original_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_default_customer_name text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_delivery_fee numeric;
  v_order_id uuid;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_product_name text;
  v_color text;
  v_size text;
  v_quantity integer;
  v_price numeric;
  v_variant record;
  v_available_stock integer;
  v_alternatives_message text;
  v_response_message text := '';
  v_has_errors boolean := false;
  v_employee_code text;
  v_first_line text;
  v_is_city boolean := false;
BEGIN
  RAISE NOTICE '🔍 بدء معالجة الطلب - كود الموظف: %, عدد العناصر: %', p_employee_code, jsonb_array_length(p_items);
  
  -- البحث عن الموظف
  SELECT user_id, telegram_code INTO v_employee_id, v_employee_code
  FROM public.telegram_employee_codes
  WHERE telegram_code = p_employee_code 
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على موظف بالكود: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', '❌ كود الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: %', v_employee_id;

  -- جلب الاسم الافتراضي للزبون من البروفايل
  SELECT COALESCE(p.default_customer_name, 'زبون تليغرام')
  INTO v_default_customer_name
  FROM public.profiles p
  WHERE p.user_id = v_employee_id
  LIMIT 1;

  RAISE NOTICE '📝 الاسم الافتراضي للزبون: %', v_default_customer_name;

  -- منطق استخراج اسم الزبون الذكي
  IF p_original_text IS NOT NULL AND p_original_text != '' THEN
    -- استخراج السطر الأول
    v_first_line := TRIM(SPLIT_PART(p_original_text, E'\n', 1));
    
    -- فحص إذا كان السطر الأول اسم مدينة صحيحة
    SELECT EXISTS(
      SELECT 1 FROM public.cities_cache 
      WHERE LOWER(name) = LOWER(v_first_line)
         OR LOWER(COALESCE(name_ar, '')) = LOWER(v_first_line)
         OR LOWER(COALESCE(name_en, '')) = LOWER(v_first_line)
    ) INTO v_is_city;
    
    RAISE NOTICE '🔍 السطر الأول: "%" - هل هو مدينة؟ %', v_first_line, v_is_city;
    
    IF v_is_city THEN
      -- السطر الأول مدينة → استخدم الاسم الافتراضي
      v_customer_name := v_default_customer_name;
      RAISE NOTICE '🏙️ السطر الأول مدينة، استخدام الاسم الافتراضي: %', v_customer_name;
    ELSIF v_first_line IS NOT NULL AND v_first_line != '' THEN
      -- السطر الأول ليس مدينة → استخدمه كاسم الزبون
      v_customer_name := v_first_line;
      RAISE NOTICE '👤 السطر الأول اسم زبون: %', v_customer_name;
    ELSE
      -- لا يوجد نص → استخدم الافتراضي
      v_customer_name := v_default_customer_name;
      RAISE NOTICE '📋 لا يوجد سطر أول، استخدام الاسم الافتراضي: %', v_customer_name;
    END IF;
  ELSE
    -- إذا لم يوجد نص أصلي، استخدم المعامل المُمرر أو الافتراضي
    v_customer_name := COALESCE(p_customer_name, v_default_customer_name);
    RAISE NOTICE '📋 لا يوجد نص أصلي، استخدام: %', v_customer_name;
  END IF;

  v_customer_phone := COALESCE(p_customer_phone, 'غير محدد');
  v_customer_address := COALESCE(p_customer_address, 'غير محدد');
  v_delivery_fee := COALESCE(p_delivery_fee, 5000);

  -- فحص كل عنصر في الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_name := v_item->>'product_name';
    v_color := v_item->>'color';
    v_size := v_item->>'size';
    v_quantity := COALESCE((v_item->>'quantity')::integer, 1);
    v_price := COALESCE((v_item->>'price')::numeric, 0);
    v_alternatives_message := v_item->>'alternatives_message';

    RAISE NOTICE '📦 معالجة عنصر: % - % - % × %', v_product_name, v_color, v_size, v_quantity;

    -- إذا كان هناك رسالة بدائل، العنصر غير متوفر
    IF v_alternatives_message IS NOT NULL AND v_alternatives_message != '' THEN
      v_has_errors := true;
      v_response_message := v_response_message || v_alternatives_message || E'\n\n';
      RAISE NOTICE '⚠️ عنصر غير متوفر: %', v_product_name;
      CONTINUE;
    END IF;

    -- العنصر متوفر، احسب السعر
    v_total_amount := v_total_amount + (v_price * v_quantity);
    RAISE NOTICE '💰 إضافة للمجموع: % × % = %', v_price, v_quantity, v_price * v_quantity;
  END LOOP;

  -- إذا كانت هناك أخطاء، لا تنشئ الطلب
  IF v_has_errors THEN
    RAISE NOTICE '❌ توقف إنشاء الطلب بسبب عناصر غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'items_unavailable',
      'message', v_response_message
    );
  END IF;

  -- إضافة رسوم التوصيل
  v_total_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المجموع النهائي (مع التوصيل): %', v_total_amount;

  -- إنشاء رسالة النجاح
  v_response_message := '✅ تم إنشاء طلب جديد بنجاح!' || E'\n\n';
  v_response_message := v_response_message || '🔹 ' || v_customer_name || E'\n';
  v_response_message := v_response_message || '📱 ' || v_customer_phone || E'\n';
  v_response_message := v_response_message || '📍 ' || v_customer_address || E'\n';
  v_response_message := v_response_message || '💰 المبلغ الإجمالي: ' || v_total_amount || ' IQD' || E'\n';
  v_response_message := v_response_message || E'\n' || '✨ يمكنك متابعة الطلب من لوحة التحكم';

  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح - المبلغ: %', v_total_amount;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_total_amount,
    'message', v_response_message,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % - %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة طلبك: ' || SQLERRM
    );
END;
$function$;