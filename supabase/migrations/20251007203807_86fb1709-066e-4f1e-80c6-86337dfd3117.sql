-- إصلاح الدالة بشكل صحيح: حذف ثم إعادة إنشاء

-- 1️⃣ حذف جميع نسخ الدالة
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

-- 2️⃣ إنشاء الدالة الصحيحة مع جميع الإصلاحات
CREATE FUNCTION public.process_telegram_order(
  p_employee_code TEXT,
  p_message_text TEXT,
  p_telegram_chat_id BIGINT,
  p_city_id INTEGER,
  p_region_id INTEGER,
  p_city_name TEXT,
  p_region_name TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_customer_name TEXT := 'زبون تليغرام';
  v_customer_phone TEXT;
  v_customer_address TEXT;
  v_items JSONB;
  v_total_amount NUMERIC := 0;
  v_delivery_fee NUMERIC := 5000;
  v_ai_order_id UUID;
  v_lines TEXT[];
  v_line TEXT;
  v_notes TEXT := '';
BEGIN
  RAISE NOTICE '🤖 بدء معالجة طلب تليغرام - رمز الموظف: %', p_employee_code;
  RAISE NOTICE '📝 النص المستلم: %', p_message_text;

  -- البحث عن معرف المستخدم من employee_code (إصلاح المشكلة الأساسية)
  SELECT user_id INTO v_user_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code 
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على رمز موظف نشط: %', p_employee_code;
    v_user_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  ELSE
    RAISE NOTICE '✅ تم العثور على الموظف: %', v_user_id;
  END IF;

  -- تقسيم النص إلى سطور
  v_lines := string_to_array(p_message_text, E'\n');
  
  -- استخراج الاسم من السطر الأول
  IF array_length(v_lines, 1) > 0 THEN
    v_customer_name := COALESCE(
      NULLIF(TRIM(v_lines[1]), ''),
      'زبون تليغرام'
    );
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  
  -- بناء العنوان من المدينة والمنطقة
  v_customer_address := COALESCE(p_city_name, '') || ' - ' || COALESCE(p_region_name, '');

  -- استخراج الملاحظات باستخدام regex (إصلاح استخراج الملاحظات)
  FOREACH v_line IN ARRAY v_lines LOOP
    IF v_line ~* 'ملاحظ[ةه]' THEN
      v_notes := TRIM(v_line);
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '👤 اسم الزبون: %', v_customer_name;
  RAISE NOTICE '📱 الهاتف: %', v_customer_phone;
  RAISE NOTICE '🏙️ المدينة: %', p_city_name;
  RAISE NOTICE '📍 المنطقة: %', p_region_name;
  RAISE NOTICE '🏠 العنوان: %', v_customer_address;
  RAISE NOTICE '📝 الملاحظات: %', v_notes;

  -- استخراج المنتجات
  v_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items;

  -- التحقق من وجود رسائل بدائل
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'alternatives_message') IS NOT NULL 
      AND (item->>'alternatives_message') != ''
  ) THEN
    DECLARE
      v_alternatives_message TEXT;
    BEGIN
      SELECT STRING_AGG(item->>'alternatives_message', E'\n\n')
      INTO v_alternatives_message
      FROM jsonb_array_elements(v_items) AS item
      WHERE (item->>'alternatives_message') IS NOT NULL 
        AND (item->>'alternatives_message') != '';
      
      RAISE NOTICE '⚠️ تم العثور على رسائل بدائل';
      RETURN jsonb_build_object(
        'success', false,
        'error', v_alternatives_message,
        'has_alternatives', true
      );
    END;
  END IF;

  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item;

  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;

  -- إنشاء طلب ذكي
  INSERT INTO ai_orders (
    original_text,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    items,
    total_amount,
    delivery_fee,
    order_data,
    status,
    source,
    telegram_chat_id,
    created_by,
    notes
  ) VALUES (
    p_message_text,
    v_customer_name,
    v_customer_phone,
    p_city_name,
    v_customer_address,
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    v_items,
    v_total_amount,
    v_delivery_fee,
    jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', p_city_name,
      'customer_address', v_customer_address,
      'items', v_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee
    ),
    'pending',
    'telegram',
    p_telegram_chat_id,
    v_user_id,
    NULLIF(v_notes, '')
  )
  RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب ذكي برقم: %', v_ai_order_id;

  -- إضافة رسالة النجاح (إصلاح المشكلة الثالثة)
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_city', p_city_name,
    'customer_address', v_customer_address,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'items', v_items,
    'notes', v_notes,
    'message', '✅ تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$$;