-- إصلاح دالة process_telegram_order لحفظ UUID في created_by بدلاً من الإيميل
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_message_text text,
  p_telegram_chat_id bigint,
  p_employee_identifier text DEFAULT NULL,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_location_confidence numeric DEFAULT 0,
  p_location_suggestions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product_items jsonb;
  v_customer_phone text;
  v_customer_address text;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_order_id uuid;
  v_employee_id uuid;
  v_employee_name text;
  v_default_customer_name text := 'زبون تليغرام';
  v_delivery_fee numeric := 5000;
  v_customer_city text;
  v_resolved_city_name text;
  v_resolved_region_name text;
BEGIN
  RAISE NOTICE '🎯 بدء معالجة الطلب من التليغرام';
  
  -- البحث عن الموظف
  IF p_employee_identifier IS NOT NULL THEN
    SELECT u.id, u.email INTO v_employee_id, v_employee_name
    FROM telegram_employee_codes tec
    JOIN profiles u ON tec.user_id = u.id
    WHERE tec.telegram_code = p_employee_identifier
       OR tec.telegram_chat_id = p_telegram_chat_id
    LIMIT 1;
    
    IF v_employee_id IS NULL THEN
      SELECT id, email INTO v_employee_id, v_employee_name
      FROM profiles
      WHERE email = p_employee_identifier
         OR id::text = p_employee_identifier
      LIMIT 1;
    END IF;
  END IF;

  -- إذا لم نجد موظف، نستخدم المدير الافتراضي
  IF v_employee_id IS NULL THEN
    v_employee_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
    SELECT email INTO v_employee_name FROM profiles WHERE id = v_employee_id;
  END IF;

  RAISE NOTICE '👤 الموظف: % (%)', v_employee_name, v_employee_id;

  -- الحصول على اسم العميل الافتراضي من إعدادات الموظف
  SELECT default_customer_name INTO v_default_customer_name
  FROM profiles
  WHERE id = v_employee_id
  LIMIT 1;

  -- إذا لم يكن هناك اسم افتراضي، نستخدم "زبون تليغرام"
  v_default_customer_name := COALESCE(NULLIF(TRIM(v_default_customer_name), ''), 'زبون تليغرام');

  RAISE NOTICE '📝 اسم العميل الافتراضي: %', v_default_customer_name;

  -- الحصول على اسم المدينة والمنطقة المحلولة
  IF p_city_id IS NOT NULL THEN
    SELECT name INTO v_resolved_city_name FROM cities_cache WHERE id = p_city_id;
  END IF;
  
  IF p_region_id IS NOT NULL THEN
    SELECT name INTO v_resolved_region_name FROM regions_cache WHERE id = p_region_id;
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractPhoneFromText(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف: %', v_customer_phone;

  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);
  RAISE NOTICE '📍 العنوان: %', v_customer_address;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 عدد المنتجات: %', jsonb_array_length(v_product_items);

  -- حساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- تحديد اسم المدينة
  v_customer_city := COALESCE(v_resolved_city_name, 'غير محدد');

  -- إنشاء سجل الطلب الذكي
  INSERT INTO ai_orders (
    telegram_chat_id,
    items,
    total_amount,
    order_data,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    delivery_fee,
    source,
    status,
    created_by,
    city_id,
    region_id,
    location_confidence,
    location_suggestions,
    original_text,
    resolved_city_name,
    resolved_region_name
  ) VALUES (
    p_telegram_chat_id,
    v_product_items,
    v_total_amount,
    jsonb_build_object(
      'raw_message', p_message_text,
      'employee_id', v_employee_id,
      'employee_name', v_employee_name,
      'default_customer_name', v_default_customer_name
    ),
    v_default_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_delivery_fee,
    'telegram',
    'pending',
    v_employee_id::text,  -- ✅ حفظ UUID كنص بدلاً من الإيميل
    p_city_id,
    p_region_id,
    p_location_confidence,
    p_location_suggestions,
    p_message_text,
    v_resolved_city_name,
    v_resolved_region_name
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب الذكي: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_order_id,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'customer_name', v_default_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'customer_city', v_customer_city,
    'delivery_fee', v_delivery_fee,
    'employee_id', v_employee_id,
    'employee_name', v_employee_name,
    'city_id', p_city_id,
    'region_id', p_region_id,
    'resolved_city_name', v_resolved_city_name,
    'resolved_region_name', v_resolved_region_name,
    'location_confidence', p_location_confidence
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'items', '[]'::jsonb
    );
END;
$$;