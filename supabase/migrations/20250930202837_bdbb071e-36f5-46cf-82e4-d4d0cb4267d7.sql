-- إصلاح نهائي: تصحيح اسم العمود في دالة process_telegram_order
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_text text,
  p_employee_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id uuid;
  v_chat_id bigint;
  v_phone text;
  v_city_name text;
  v_city_id integer;
  v_address text;
  v_product_items jsonb;
  v_alternatives_message text := '';
  v_order_id uuid;
BEGIN
  RAISE NOTICE '🔍 بدء معالجة الطلب - رمز الموظف: %', p_employee_code;

  -- الحصول على معرف الموظف من رمزه
  SELECT user_id, telegram_chat_id 
  INTO v_employee_id, v_chat_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code  -- تصحيح: استخدام employee_code بدلاً من telegram_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على موظف برمز: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز الموظف غير صحيح أو غير نشط',
      'error', 'invalid_employee_code'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: %', v_employee_id;

  -- استخراج رقم الهاتف
  v_phone := extractPhoneFromText(p_order_text);
  RAISE NOTICE '📞 رقم الهاتف: %', v_phone;

  -- استخراج المدينة باستخدام الدالة الذكية
  SELECT city_id, city_name INTO v_city_id, v_city_name
  FROM smart_search_city(p_order_text)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_id IS NULL THEN
    v_city_name := 'غير محدد';
    RAISE NOTICE '⚠️ لم يتم التعرف على المدينة';
  ELSE
    RAISE NOTICE '🏙️ المدينة: % (ID: %)', v_city_name, v_city_id;
  END IF;

  -- استخراج العنوان
  v_address := extract_actual_address(p_order_text);
  RAISE NOTICE '📍 العنوان: %', v_address;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_order_text);
  RAISE NOTICE '📦 المنتجات: %', v_product_items;

  -- التحقق من وجود رسالة بدائل (منتج غير متوفر)
  IF v_product_items->0->>'is_available' = 'false' THEN
    v_alternatives_message := v_product_items->0->>'alternatives_message';
    RAISE NOTICE '⚠️ منتج غير متوفر - رسالة البدائل: %', v_alternatives_message;
    
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_message,
      'product_unavailable', true
    );
  END IF;

  -- إنشاء الطلب
  INSERT INTO public.orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    total_amount,
    final_amount,
    status,
    source,
    created_by,
    telegram_chat_id
  )
  VALUES (
    'زبون تليغرام',
    v_phone,
    v_city_name,
    v_address,
    v_city_id,
    (v_product_items->0->>'total_price')::numeric,
    (v_product_items->0->>'total_price')::numeric,
    'pending',
    'telegram',
    v_employee_id,
    v_chat_id
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء الطلب بنجاح',
    'order_id', v_order_id,
    'order_details', jsonb_build_object(
      'phone', v_phone,
      'city', v_city_name,
      'address', v_address,
      'products', v_product_items
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$$;