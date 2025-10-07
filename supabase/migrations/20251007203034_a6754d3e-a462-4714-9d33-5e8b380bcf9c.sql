-- إرجاع دالة process_telegram_order إلى النسخة العاملة مع إضافة الملاحظات
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_text TEXT,
  p_chat_id BIGINT DEFAULT NULL,
  p_source TEXT DEFAULT 'telegram'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lines TEXT[];
  v_line TEXT;
  v_customer_name TEXT := 'زبون تليغرام';
  v_customer_phone TEXT;
  v_customer_city TEXT;
  v_customer_address TEXT;
  v_items JSONB;
  v_total_amount NUMERIC := 0;
  v_delivery_fee NUMERIC := 5000;
  v_ai_order_id UUID;
  v_notes TEXT := '';
  v_alternatives_found BOOLEAN := FALSE;
  v_alternatives_message TEXT := '';
  v_created_by_user UUID;
BEGIN
  RAISE NOTICE '🤖 بدء معالجة طلب تليغرام';
  RAISE NOTICE '📝 النص المستلم: %', p_text;

  -- البحث عن رمز الموظف في النص
  SELECT user_id INTO v_created_by_user
  FROM public.employee_telegram_codes
  WHERE telegram_chat_id = p_chat_id
    AND is_active = true
  LIMIT 1;

  IF v_created_by_user IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على رمز موظف نشط لـ chat_id: %', p_chat_id;
    v_created_by_user := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  ELSE
    RAISE NOTICE '✅ تم العثور على الموظف: %', v_created_by_user;
  END IF;

  -- تقسيم النص إلى سطور
  v_lines := string_to_array(p_text, E'\n');
  
  -- استخراج الملاحظات
  FOREACH v_line IN ARRAY v_lines LOOP
    IF v_line ~* 'ملاحظ[ةه]' THEN
      v_notes := TRIM(v_line);
      EXIT;
    END IF;
  END LOOP;

  -- استخراج المعلومات الأساسية
  v_customer_name := COALESCE(
    NULLIF(TRIM(SPLIT_PART(v_lines[1], E'\n', 1)), ''),
    'زبون تليغرام'
  );

  v_customer_phone := extractphonefromtext(p_text);
  v_customer_city := 'الديوانية';
  v_customer_address := extract_actual_address(p_text);

  RAISE NOTICE '👤 اسم الزبون: %', v_customer_name;
  RAISE NOTICE '📱 الهاتف: %', v_customer_phone;
  RAISE NOTICE '📍 المدينة: %', v_customer_city;
  RAISE NOTICE '🏠 العنوان: %', v_customer_address;
  RAISE NOTICE '📝 الملاحظات: %', v_notes;

  -- استخراج المنتجات
  v_items := extract_product_items_from_text(p_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items;

  -- التحقق من وجود رسائل بدائل
  SELECT 
    BOOL_OR((item->>'alternatives_message') IS NOT NULL AND (item->>'alternatives_message') != ''),
    STRING_AGG(item->>'alternatives_message', E'\n\n')
  INTO v_alternatives_found, v_alternatives_message
  FROM jsonb_array_elements(v_items) AS item;

  -- إذا وجدنا بدائل، نرجع رسالة البدائل مباشرة
  IF v_alternatives_found THEN
    RAISE NOTICE '⚠️ تم العثور على رسائل بدائل';
    RETURN jsonb_build_object(
      'success', false,
      'error', v_alternatives_message,
      'has_alternatives', true
    );
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
    p_text,
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_address,
    v_items,
    v_total_amount,
    v_delivery_fee,
    jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', v_customer_city,
      'customer_address', v_customer_address,
      'items', v_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee
    ),
    'pending',
    p_source,
    p_chat_id,
    COALESCE(v_created_by_user::text, '91484496-b887-44f7-9e5d-be9db5567604'),
    NULLIF(v_notes, '')
  )
  RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب ذكي برقم: %', v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
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