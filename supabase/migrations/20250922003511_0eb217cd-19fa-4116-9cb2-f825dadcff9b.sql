-- إصلاح دالة process_telegram_order لحل مشكلة إنشاء الطلبات من التليغرام
DROP FUNCTION IF EXISTS process_telegram_order(jsonb, text, bigint);

-- إنشاء الدالة المحدثة
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
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

  -- الحصول على معلومات الموظف باستخدام رمز التليغرام وربطه بـ profiles
  SELECT p.employee_code as internal_code, p.user_id, p.full_name
  INTO v_employee_record
  FROM profiles p
  JOIN telegram_employee_codes tec ON p.user_id = tec.user_id
  WHERE tec.employee_code = p_employee_code  -- هذا هو رمز التليغرام (مثل RYU559)
    AND tec.telegram_chat_id = p_chat_id
    AND tec.is_active = true;

  IF v_employee_record.user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مصرح له'
    );
  END IF;

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

  -- حساب رسوم التوصيل (افتراضي 5000 إذا لم تكن محددة)
  v_delivery_fee := COALESCE((p_order_data->>'delivery_fee')::numeric, 5000);

  -- توليد رقم الطلب باستخدام الدالة المناسبة
  v_order_number := generate_order_number();

  -- إنشاء الطلب
  INSERT INTO orders (
    order_number, customer_id, customer_name, customer_phone, customer_address,
    customer_city, customer_region, city_id, region_id, delivery_fee,
    total_amount, final_amount, status, created_by, source
  ) VALUES (
    v_order_number, v_customer_record.id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_region, v_city_id, v_region_id, v_delivery_fee,
    0, v_delivery_fee, 'pending', v_employee_record.user_id, 'telegram'
  ) RETURNING id INTO v_order_id;

  -- معالجة عناصر الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    -- البحث عن المنتج
    SELECT id, name, price, cost_price
    INTO v_product_record
    FROM products
    WHERE LOWER(name) LIKE '%' || LOWER(v_item->>'name') || '%'
      OR LOWER(sku) = LOWER(v_item->>'sku')
    ORDER BY 
      CASE WHEN LOWER(name) = LOWER(v_item->>'name') THEN 1 ELSE 2 END,
      similarity(LOWER(name), LOWER(v_item->>'name')) DESC
    LIMIT 1;

    IF v_product_record.id IS NULL THEN
      -- إنشاء منتج جديد إذا لم يوجد
      INSERT INTO products (
        name, price, cost_price, sku, created_by, source
      ) VALUES (
        v_item->>'name',
        COALESCE((v_item->>'price')::numeric, 0),
        COALESCE((v_item->>'cost_price')::numeric, 0),
        COALESCE(v_item->>'sku', 'TG-' || v_order_id::text),
        v_employee_record.user_id,
        'telegram'
      ) RETURNING id, price INTO v_product_record;
    END IF;

    -- البحث عن المتغير (إذا كان متاحاً)
    SELECT id, price
    INTO v_variant_record
    FROM product_variants pv
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes s ON pv.size_id = s.id
    WHERE pv.product_id = v_product_record.id
      AND (LOWER(c.name) = LOWER(COALESCE(v_item->>'color', '')) OR v_item->>'color' IS NULL)
      AND (LOWER(s.name) = LOWER(COALESCE(v_item->>'size', '')) OR v_item->>'size' IS NULL)
    LIMIT 1;

    -- إضافة عنصر الطلب
    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity, price, total_price
    ) VALUES (
      v_order_id,
      v_product_record.id,
      v_variant_record.id,
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE(v_variant_record.price, v_product_record.price, (v_item->>'price')::numeric, 0),
      COALESCE((v_item->>'quantity')::integer, 1) * COALESCE(v_variant_record.price, v_product_record.price, (v_item->>'price')::numeric, 0)
    );

    -- تحديث المجموع
    v_order_total := v_order_total + (COALESCE((v_item->>'quantity')::integer, 1) * COALESCE(v_variant_record.price, v_product_record.price, (v_item->>'price')::numeric, 0));
  END LOOP;

  -- تحديث إجمالي الطلب
  UPDATE orders
  SET total_amount = v_order_total,
      final_amount = v_order_total + v_delivery_fee,
      updated_at = now()
  WHERE id = v_order_id;

  -- إنشاء سجل في ai_orders للربط
  INSERT INTO ai_orders (
    customer_name, customer_phone, customer_address, customer_city, customer_province,
    city_id, region_id, items, total_amount, status, source, 
    telegram_chat_id, processed_by, processed_at, related_order_id,
    original_text, created_by
  ) VALUES (
    v_customer_name, v_customer_phone, v_customer_address, v_customer_city, v_customer_region,
    v_city_id, v_region_id, p_order_data->'items', v_order_total, 'processed', 'telegram',
    p_chat_id, v_employee_record.user_id, now(), v_order_id,
    p_order_data->>'original_text', v_employee_record.internal_code
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'ai_order_id', v_ai_order_id,
    'customer_id', v_customer_record.id,
    'total_amount', v_order_total,
    'final_amount', v_order_total + v_delivery_fee,
    'message', 'تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', 'فشل في معالجة الطلب: ' || SQLERRM
    );
END;
$$;