-- حذف جميع نسخ process_telegram_order بغض النظر عن التوقيع
DROP FUNCTION IF EXISTS process_telegram_order(text, text, bigint) CASCADE;
DROP FUNCTION IF EXISTS process_telegram_order(bigint, text, text) CASCADE;
DROP FUNCTION IF EXISTS process_telegram_order CASCADE;

-- إنشاء النسخة الصحيحة الوحيدة من process_telegram_order
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_default_customer_name text := 'زبون تليغرام';
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_city_id integer;
  v_region_id integer;
  v_products jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_ai_order_id uuid;
  v_lines text[];
  v_first_line text;
  v_name_from_text text;
  v_result jsonb;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام - كود الموظف: %, النص: %', p_employee_code, p_message_text;

  -- 1. العثور على user_id من employee_code
  SELECT user_id INTO v_user_id
  FROM telegram_employee_codes
  WHERE telegram_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ كود الموظف غير صحيح: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على المستخدم: %', v_user_id;

  -- 2. قراءة default_customer_name من profiles
  SELECT COALESCE(NULLIF(TRIM(default_customer_name), ''), 'زبون تليغرام')
  INTO v_default_customer_name
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  RAISE NOTICE '📝 الاسم الافتراضي من الإعدادات: %', v_default_customer_name;

  -- 3. استخراج الاسم الذكي من السطر الأول
  v_lines := string_to_array(p_message_text, E'\n');
  v_first_line := COALESCE(NULLIF(TRIM(v_lines[1]), ''), '');
  
  IF v_first_line ~ '^[^\d+]*$' AND length(v_first_line) > 2 AND length(v_first_line) < 50 THEN
    v_name_from_text := v_first_line;
    RAISE NOTICE '✅ تم استخراج الاسم من السطر الأول: %', v_name_from_text;
  END IF;

  -- استخدام الاسم المستخرج أو الافتراضي
  v_customer_name := COALESCE(v_name_from_text, v_default_customer_name);

  -- 4. استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_customer_phone;

  -- 5. استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);
  RAISE NOTICE '📍 العنوان المستخرج: %', v_customer_address;

  -- 6. البحث الذكي عن المدينة
  SELECT city_id, city_name INTO v_city_id, v_customer_city
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  RAISE NOTICE '🏙️ المدينة المستخرجة: % (ID: %)', v_customer_city, v_city_id;

  -- 7. استخراج المنتجات
  v_products := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_products;

  -- 8. حساب المبلغ الإجمالي (مع رسوم التوصيل)
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_products) AS item;

  v_total_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي مع التوصيل: %', v_total_amount;

  -- 9. إنشاء ai_order في جدول ai_orders
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    city_id,
    region_id,
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
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_city_id,
    v_region_id,
    v_products,
    v_total_amount,
    'pending',
    'telegram',
    p_telegram_chat_id,
    v_user_id::text,
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'delivery_fee', v_delivery_fee
    )
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء AI Order: %', v_ai_order_id;

  -- 10. إرجاع البيانات الكاملة
  v_result := jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'extracted_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_city', v_customer_city,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'products', v_products,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'created_by', v_user_id
    )
  );

  RAISE NOTICE '✅ نجح إنشاء الطلب الذكي';
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$$;