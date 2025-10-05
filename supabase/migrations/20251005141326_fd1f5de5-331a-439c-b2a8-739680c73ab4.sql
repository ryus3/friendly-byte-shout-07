-- حذف جميع النسخ القديمة من process_telegram_order
DROP FUNCTION IF EXISTS process_telegram_order(text, bigint, text);

-- إنشاء النسخة الصحيحة النهائية
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_telegram_code text,
  p_telegram_chat_id bigint,
  p_order_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_default_customer_name text := 'ريوس';
  v_product_items jsonb;
  v_phone text;
  v_city_name text;
  v_region_name text;
  v_address text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_order_id uuid;
  v_city_id integer;
  v_region_id integer;
  v_location_confidence numeric := 0;
  v_item jsonb;
BEGIN
  -- الحصول على معلومات الموظف من telegram_code
  SELECT u.id, u.full_name, COALESCE(NULLIF(p.default_customer_name, ''), 'ريوس')
  INTO v_employee_id, v_employee_name, v_default_customer_name
  FROM employee_telegram_codes etc
  JOIN auth.users u ON etc.user_id = u.id
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE etc.telegram_code = p_telegram_code
    AND etc.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    SELECT u.id, u.full_name, COALESCE(NULLIF(p.default_customer_name, ''), 'ريوس')
    INTO v_employee_id, v_employee_name, v_default_customer_name
    FROM employee_telegram_codes etc
    JOIN auth.users u ON etc.user_id = u.id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE etc.telegram_chat_id = p_telegram_chat_id
      AND etc.is_active = true
    LIMIT 1;
  END IF;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'لم يتم العثور على الموظف المرتبط بهذا الحساب'
    );
  END IF;

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_order_text);

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_order_text);

  -- التحقق من توفر المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', v_item->>'alternatives_message',
        'items', v_product_items
      );
    END IF;
    v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
  END LOOP;

  -- استخراج العنوان
  v_address := extract_actual_address(p_order_text);

  -- إنشاء سجل ai_orders
  INSERT INTO ai_orders (
    telegram_chat_id,
    created_by,
    original_text,
    items,
    total_amount,
    delivery_fee,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    resolved_city_name,
    resolved_region_name,
    city_id,
    region_id,
    location_confidence,
    status,
    source,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    v_employee_name,
    p_order_text,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    v_default_customer_name,
    v_phone,
    v_address,
    v_city_name,
    v_city_name,
    v_region_name,
    v_city_id,
    v_region_id,
    v_location_confidence,
    'pending',
    'telegram',
    jsonb_build_object(
      'employee_id', v_employee_id,
      'employee_name', v_employee_name,
      'telegram_code', p_telegram_code
    )
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'customer_name', v_default_customer_name,
    'phone', v_phone,
    'address', v_address
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$$;

-- تحديث البيانات الموجودة
UPDATE ai_orders 
SET created_by = 'المدير العام'
WHERE source = 'telegram' 
  AND (created_by = 'ryusbrand@gmail.com' OR created_by LIKE '%@%');

UPDATE ai_orders ao
SET customer_name = COALESCE(p.default_customer_name, 'ريوس')
FROM profiles p
WHERE ao.source = 'telegram'
  AND ao.customer_name = 'زبون تليغرام'
  AND p.email = 'ryusbrand@gmail.com';