-- إصلاح دالة process_telegram_order لحل مشكلة عدم العثور على الموظف
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_telegram_employee_code text, p_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_record RECORD;
  v_customer_record RECORD;
  v_order_id uuid;
  v_item jsonb;
  v_product_record RECORD;
  v_variant_record RECORD;
  v_order_total numeric := 0;
  v_city_id integer;
  v_region_id integer;
  v_customer_city text;
  v_customer_region text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_delivery_fee numeric := 0;
  v_order_number text;
  v_ai_order_id uuid;
BEGIN
  -- التحقق من صحة البيانات المرسلة
  IF p_order_data IS NULL OR jsonb_typeof(p_order_data) != 'object' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_order_data',
      'message', 'بيانات الطلب غير صحيحة'
    );
  END IF;

  -- البحث عن الموظف بطريقة محسنة
  -- أولاً: البحث بـ chat_id فقط (الطريقة الأساسية والموثوقة)
  SELECT 
    p.employee_code as internal_employee_code, 
    p.user_id, 
    p.full_name,
    tec.employee_code as telegram_code
  INTO v_employee_record
  FROM telegram_employee_codes tec
  JOIN profiles p ON tec.user_id = p.user_id
  WHERE tec.telegram_chat_id = p_chat_id
    AND tec.is_active = true;

  -- إذا لم نجد الموظف بـ chat_id، ابحث بالكود مع chat_id
  IF v_employee_record.user_id IS NULL THEN
    SELECT 
      p.employee_code as internal_employee_code, 
      p.user_id, 
      p.full_name,
      tec.employee_code as telegram_code
    INTO v_employee_record
    FROM telegram_employee_codes tec
    JOIN profiles p ON tec.user_id = p.user_id
    WHERE tec.employee_code = p_telegram_employee_code
      AND tec.telegram_chat_id = p_chat_id
      AND tec.is_active = true;
  END IF;

  -- إذا لم نجد الموظف، ابحث بالكود فقط (احتياطي)
  IF v_employee_record.user_id IS NULL THEN
    SELECT 
      p.employee_code as internal_employee_code, 
      p.user_id, 
      p.full_name,
      tec.employee_code as telegram_code
    INTO v_employee_record
    FROM telegram_employee_codes tec
    JOIN profiles p ON tec.user_id = p.user_id
    WHERE tec.employee_code = p_telegram_employee_code
      AND tec.is_active = true
    LIMIT 1;
  END IF;

  IF v_employee_record.user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود - كود: ' || p_telegram_employee_code || ' - chat: ' || p_chat_id,
      'debug_info', jsonb_build_object(
        'telegram_code', p_telegram_employee_code,
        'chat_id', p_chat_id
      )
    );
  END IF;

  -- إنشاء سجل في ai_orders أولاً (هذا هو المطلوب لنافذة الطلبات الذكية)
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    items,
    total_amount,
    order_data,
    telegram_chat_id,
    created_by,
    source,
    status,
    original_text
  ) VALUES (
    COALESCE(p_order_data->>'customer_name', 'غير محدد'),
    p_order_data->>'customer_phone',
    COALESCE(p_order_data->>'customer_address', 'غير محدد'),
    COALESCE(p_order_data->>'customer_city', 'غير محدد'),
    COALESCE(p_order_data->>'customer_region', 'غير محدد'),
    COALESCE(p_order_data->'items', '[]'::jsonb),
    COALESCE((p_order_data->>'total_price')::numeric, 0),
    p_order_data,
    p_chat_id,
    v_employee_record.user_id,
    'telegram',
    'pending',
    COALESCE(p_order_data->>'original_text', 'طلب من التليغرام')
  ) RETURNING id INTO v_ai_order_id;

  -- استخراج بيانات العميل من بيانات الطلب
  v_customer_name := COALESCE(p_order_data->>'customer_name', 'غير محدد');
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := COALESCE(p_order_data->>'customer_address', 'غير محدد');
  v_customer_city := COALESCE(p_order_data->>'customer_city', 'غير محدد');
  v_customer_region := COALESCE(p_order_data->>'customer_region', 'غير محدد');

  -- البحث أو إنشاء العميل
  SELECT id INTO v_customer_record
  FROM customers
  WHERE phone = v_customer_phone AND created_by = v_employee_record.user_id
  LIMIT 1;

  IF v_customer_record.id IS NULL THEN
    INSERT INTO customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      v_customer_name, v_customer_phone, v_customer_address, 
      v_customer_city, v_customer_region, v_employee_record.user_id
    ) RETURNING id INTO v_customer_record;
  END IF;

  -- البحث عن المدينة والمنطقة في الكاش
  SELECT id INTO v_city_id
  FROM cities_cache
  WHERE LOWER(name) = LOWER(v_customer_city) OR LOWER(name_ar) = LOWER(v_customer_city)
  LIMIT 1;

  SELECT id INTO v_region_id
  FROM regions_cache
  WHERE LOWER(name) = LOWER(v_customer_region) OR LOWER(name_ar) = LOWER(v_customer_region)
    AND (v_city_id IS NULL OR city_id = v_city_id)
  LIMIT 1;

  -- حساب رسوم التوصيل
  v_delivery_fee := COALESCE((p_order_data->>'delivery_fee')::numeric, 5000);

  -- توليد رقم الطلب
  v_order_number := generate_order_number();

  -- إنشاء الطلب الفعلي
  INSERT INTO orders (
    order_number, customer_id, customer_name, customer_phone, customer_address,
    customer_city, customer_region, city_id, region_id, delivery_fee,
    total_amount, final_amount, status, created_by, source
  ) VALUES (
    v_order_number, v_customer_record.id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_region, v_city_id, v_region_id, v_delivery_fee,
    COALESCE((p_order_data->>'total_price')::numeric, 0), 
    COALESCE((p_order_data->>'total_price')::numeric, 0) + v_delivery_fee, 
    'pending', v_employee_record.user_id, 'telegram'
  ) RETURNING id INTO v_order_id;

  -- ربط الطلب الذكي بالطلب الحقيقي
  UPDATE ai_orders SET related_order_id = v_order_id WHERE id = v_ai_order_id;

  -- معالجة عناصر الطلب (إذا كانت موجودة)
  IF p_order_data ? 'items' AND jsonb_typeof(p_order_data->'items') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
    LOOP
      -- البحث عن المنتج
      SELECT id, name, price, cost_price
      INTO v_product_record
      FROM products
      WHERE LOWER(name) LIKE '%' || LOWER(COALESCE(v_item->>'product_name', '')) || '%'
      LIMIT 1;

      IF v_product_record.id IS NOT NULL THEN
        -- البحث عن المتغير (إذا كان موجوداً)
        SELECT id, price, cost_price
        INTO v_variant_record
        FROM product_variants
        WHERE product_id = v_product_record.id
        LIMIT 1;

        -- إضافة عنصر الطلب
        INSERT INTO order_items (
          order_id, product_id, variant_id, quantity, price, total_price
        ) VALUES (
          v_order_id, 
          v_product_record.id, 
          v_variant_record.id,
          COALESCE((v_item->>'quantity')::integer, 1),
          COALESCE(v_variant_record.price, v_product_record.price, 0),
          COALESCE((v_item->>'quantity')::integer, 1) * COALESCE(v_variant_record.price, v_product_record.price, 0)
        );

        v_order_total := v_order_total + (COALESCE((v_item->>'quantity')::integer, 1) * COALESCE(v_variant_record.price, v_product_record.price, 0));
      END IF;
    END LOOP;

    -- تحديث إجمالي الطلب
    UPDATE orders 
    SET total_amount = v_order_total,
        final_amount = v_order_total + v_delivery_fee
    WHERE id = v_order_id;
  END IF;

  RAISE NOTICE 'تم إنشاء طلب تليغرام بنجاح - AI Order: %, Real Order: %, Employee: %', 
    v_ai_order_id, v_order_id, v_employee_record.telegram_code;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'employee_code', v_employee_record.telegram_code,
    'message', 'تم إنشاء الطلب بنجاح'
  );
END;
$function$;