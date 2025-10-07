-- تعديل دالة process_telegram_order لإضافة فحص مرادفات المدن
-- حذف الدالة القديمة وإعادة إنشائها مع الفحص المحدث

DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_region_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_default_customer_name text := 'زبون تليغرام';
  v_customer_address text;
  v_delivery_fee numeric := 5000;
  v_items_json jsonb;
  v_city_id integer;
  v_region_id integer;
  v_city_name text;
  v_region_name text;
  v_order_id uuid;
  v_alternatives_message text := '';
  v_item jsonb;
  v_total_amount numeric := 0;
  v_location_confidence numeric := 0;
  v_location_suggestions jsonb := '[]'::jsonb;
  v_original_text text;
  v_first_line text;
  v_is_city boolean := false;
BEGIN
  RAISE NOTICE '🔵 بدء معالجة طلب تليغرام - كود الموظف: %, رقم الدردشة: %', p_employee_code, p_telegram_chat_id;
  RAISE NOTICE '📝 النص الكامل: %', p_message_text;
  RAISE NOTICE '📍 المعاملات المستلمة - المدينة: % (%), المنطقة: % (%)', p_city_name, p_city_id, p_region_name, p_region_id;

  -- التحقق من كود الموظف
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE telegram_code = p_employee_code 
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '❌ كود الموظف غير صالح: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صالح',
      'message', '❌ كود الموظف غير موجود أو غير مفعل. الرجاء التحقق من الكود.'
    );
  END IF;

  RAISE NOTICE '✅ تم التحقق من الموظف: %', v_employee_id;

  -- استخراج رقم الهاتف
  v_customer_phone := public.extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_customer_phone;

  -- استخراج العنوان الفعلي (قرب ...)
  v_customer_address := public.extract_actual_address(p_message_text);
  RAISE NOTICE '🏠 العنوان المستخرج: %', v_customer_address;

  -- حفظ النص الأصلي قبل المعالجة
  v_original_text := p_message_text;

  -- استخراج السطر الأول من النص
  v_first_line := TRIM(SPLIT_PART(p_message_text, E'\n', 1));

  -- فحص إذا كان السطر الأول يبدأ بمدينة أو مرادف مدينة
  SELECT (
    EXISTS(
      SELECT 1 FROM public.cities_cache 
      WHERE LOWER(v_first_line) ILIKE LOWER(name) || '%'
         OR LOWER(v_first_line) ILIKE LOWER(name_ar) || '%'
         OR LOWER(v_first_line) ILIKE LOWER(name_en) || '%'
    ) OR EXISTS(
      SELECT 1 FROM public.city_aliases ca
      JOIN public.cities_cache cc ON cc.id = ca.city_id
      WHERE cc.is_active = true
        AND (LOWER(v_first_line) ILIKE LOWER(ca.alias_name) || '%'
             OR LOWER(v_first_line) ILIKE '%' || LOWER(ca.alias_name) || '%'
             OR LOWER(v_first_line) ILIKE LOWER(ca.normalized_name) || '%'
             OR LOWER(v_first_line) ILIKE '%' || LOWER(ca.normalized_name) || '%')
    )
  ) INTO v_is_city;

  -- المنطق الذكي لتحديد اسم الزبون
  IF v_is_city THEN
    -- إذا كان السطر الأول يبدأ بمدينة، استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
  ELSIF v_first_line IS NOT NULL AND v_first_line != '' THEN
    -- إذا لم يبدأ بمدينة وغير فارغ، استخدمه كاسم الزبون
    v_customer_name := v_first_line;
  ELSE
    -- إذا كان السطر الأول فارغ، استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
  END IF;

  RAISE NOTICE '👤 اسم الزبون النهائي: % (هل السطر الأول مدينة؟ %)', v_customer_name, v_is_city;

  -- معالجة الموقع
  IF p_city_id IS NOT NULL AND p_region_id IS NOT NULL THEN
    v_city_id := p_city_id;
    v_region_id := p_region_id;
    v_city_name := p_city_name;
    v_region_name := p_region_name;
    v_location_confidence := 100;
    RAISE NOTICE '✅ استخدام الموقع المحدد مسبقاً: مدينة % (%), منطقة % (%)', v_city_name, v_city_id, v_region_name, v_region_id;
  ELSE
    RAISE NOTICE '⚠️ لم يتم تحديد الموقع - سيتم تخزين الطلب بدون موقع';
    v_city_name := 'غير محدد';
    v_region_name := 'غير محدد';
    v_location_confidence := 0;
  END IF;

  -- استخراج المنتجات
  v_items_json := public.extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items_json;

  -- فحص وجود رسالة بدائل
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_json)
  LOOP
    IF (v_item->>'alternatives_message') IS NOT NULL 
       AND (v_item->>'alternatives_message') != '' THEN
      v_alternatives_message := v_item->>'alternatives_message';
      RAISE NOTICE '⚠️ وجدت رسالة بدائل: %', v_alternatives_message;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_not_available',
        'message', v_alternatives_message,
        'items', v_items_json
      );
    END IF;
    
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  v_total_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;

  -- إنشاء سجل في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    total_amount,
    delivery_fee,
    items,
    telegram_chat_id,
    created_by,
    status,
    source,
    original_text,
    resolved_city_name,
    resolved_region_name,
    city_id,
    region_id,
    location_confidence,
    location_suggestions
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_city_name,
    v_city_name,
    v_customer_address,
    v_total_amount,
    v_delivery_fee,
    v_items_json,
    p_telegram_chat_id,
    v_employee_id::text,
    'pending',
    'telegram',
    v_original_text,
    v_city_name,
    v_region_name,
    v_city_id,
    v_region_id,
    v_location_confidence,
    v_location_suggestions
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI بنجاح: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'city_name', v_city_name,
    'region_name', v_region_name,
    'total_amount', v_total_amount,
    'items', v_items_json,
    'message', '✅ تم إنشاء الطلب بنجاح!' || E'\n' ||
               '📦 رقم الطلب: ' || v_order_id::text || E'\n' ||
               '👤 اسم الزبون: ' || v_customer_name || E'\n' ||
               '📱 رقم الهاتف: ' || v_customer_phone || E'\n' ||
               '📍 المدينة: ' || v_city_name || E'\n' ||
               '🏘️ المنطقة: ' || v_region_name || E'\n' ||
               '💰 المبلغ الإجمالي: ' || v_total_amount::text || ' دينار'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % - %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;