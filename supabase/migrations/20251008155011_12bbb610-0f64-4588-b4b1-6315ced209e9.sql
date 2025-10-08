-- إصلاح دالة process_telegram_order لإضافة التحقق من أخطاء استخراج المنتجات
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_employee_code TEXT,
  p_message_text TEXT,
  p_telegram_chat_id BIGINT,
  p_city_id INTEGER DEFAULT NULL,
  p_region_id INTEGER DEFAULT NULL,
  p_city_name TEXT DEFAULT NULL,
  p_region_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_product_items JSONB;
  v_customer_info JSONB;
  v_order_id UUID;
  v_total_amount NUMERIC := 0;
  v_delivery_fee NUMERIC := 5000;
  v_item JSONB;
  v_first_item JSONB;
BEGIN
  -- الحصول على user_id من employee_code
  SELECT user_id INTO v_user_id
  FROM telegram_employee_codes
  WHERE employee_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_employee_code',
      'message', 'رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  RAISE NOTICE 'معالجة طلب من الموظف: % (user_id: %)', p_employee_code, v_user_id;

  -- استخراج المنتجات من النص
  v_product_items := extract_product_items_from_text(p_message_text);
  
  RAISE NOTICE 'نتيجة extract_product_items_from_text: %', v_product_items;

  -- ✅ فحص 1: هل v_product_items فارغ أو NULL؟
  IF v_product_items IS NULL OR jsonb_array_length(v_product_items) = 0 THEN
    RAISE NOTICE 'خطأ: لم يتم العثور على منتجات في النص';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_products_found',
      'message', 'لم أتمكن من العثور على منتجات في النص المرسل',
      'original_text', p_message_text
    );
  END IF;

  -- ✅ فحص 2: هل أول عنصر يحتوي على خطأ؟
  v_first_item := v_product_items->0;
  IF v_first_item->>'product_name' = 'خطأ' OR (v_first_item->>'is_available')::boolean = false THEN
    RAISE NOTICE 'خطأ في استخراج المنتجات: %', v_first_item;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'extraction_error',
      'message', COALESCE(v_first_item->>'alternatives_message', 'حدث خطأ في استخراج المنتجات'),
      'details', v_first_item,
      'original_text', p_message_text
    );
  END IF;

  -- استخراج معلومات العميل
  v_customer_info := extract_customer_info_from_text(p_message_text);

  -- حساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + (
      COALESCE((v_item->>'price')::numeric, 0) * 
      COALESCE((v_item->>'quantity')::integer, 1)
    );
  END LOOP;

  -- إنشاء سجل ai_orders
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    items,
    total_amount,
    delivery_fee,
    original_text,
    telegram_chat_id,
    created_by,
    status,
    source,
    order_data
  ) VALUES (
    COALESCE(v_customer_info->>'name', 'زبون تليغرام'),
    v_customer_info->>'phone',
    v_customer_info->>'address',
    COALESCE(p_city_name, v_customer_info->>'city'),
    v_customer_info->>'province',
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    p_message_text,
    p_telegram_chat_id,
    p_employee_code,
    'pending',
    'telegram',
    jsonb_build_object(
      'customer_info', v_customer_info,
      'items', v_product_items,
      'location', jsonb_build_object(
        'city_id', p_city_id,
        'region_id', p_region_id,
        'city_name', p_city_name,
        'region_name', p_region_name
      )
    )
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE 'تم إنشاء طلب AI رقم: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'items', v_product_items,
    'customer_info', v_customer_info,
    'message', 'تم معالجة الطلب بنجاح ✅'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في process_telegram_order: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ أثناء معالجة الطلب',
      'details', SQLERRM
    );
END;
$$;