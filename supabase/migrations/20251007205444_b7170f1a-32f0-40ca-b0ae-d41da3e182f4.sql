-- تعديل دالة process_telegram_order لإرجاع order_id بشكل صحيح
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_text text,
  p_chat_id bigint,
  p_employee_code text DEFAULT NULL::text,
  p_city_name text DEFAULT NULL::text,
  p_region_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_notes text := '';
  v_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_ai_order_id uuid;
  v_employee_id uuid;
  v_city_id integer;
  v_region_id integer;
BEGIN
  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_text);
  
  -- استخراج العنوان الفعلي
  v_customer_address := extract_actual_address(p_text);
  
  -- استخراج المنتجات
  v_items := extract_product_items_from_text(p_text);
  
  -- التحقق من وجود منتجات غير متوفرة
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'is_available')::boolean = false
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_not_available',
      'alternatives_message', (
        SELECT item->>'alternatives_message'
        FROM jsonb_array_elements(v_items) AS item
        WHERE (item->>'is_available')::boolean = false
        LIMIT 1
      )
    );
  END IF;
  
  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item;
  
  -- استخراج الملاحظات
  IF p_text ~* 'ملاحظة' THEN
    v_notes := regexp_replace(
      substring(p_text from 'ملاحظة[:\s]*(.*)'),
      E'[\\n\\r]+',
      ' ',
      'g'
    );
  END IF;
  
  -- الحصول على معرف الموظف من الكود
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_employee_id
    FROM telegram_employee_codes
    WHERE employee_code = p_employee_code
      AND is_active = true
    LIMIT 1;
  END IF;
  
  -- الحصول على city_id إذا تم توفير اسم المدينة
  IF p_city_name IS NOT NULL THEN
    SELECT id INTO v_city_id
    FROM cities_cache
    WHERE name = p_city_name OR name_ar = p_city_name OR name_en = p_city_name
    LIMIT 1;
  END IF;
  
  -- الحصول على region_id إذا تم توفير اسم المنطقة
  IF p_region_name IS NOT NULL THEN
    SELECT id INTO v_region_id
    FROM regions_cache
    WHERE name = p_region_name OR name_ar = p_region_name
    LIMIT 1;
  END IF;
  
  v_customer_name := 'زبون تليغرام';
  
  -- إنشاء الطلب الذكي
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    total_amount,
    delivery_fee,
    items,
    notes,
    original_text,
    telegram_chat_id,
    processed_by,
    processed_at,
    status,
    source,
    created_by,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    p_city_name,
    v_customer_address,
    v_total_amount + v_delivery_fee,
    v_delivery_fee,
    v_items,
    v_notes,
    p_text,
    p_chat_id,
    v_employee_id,
    now(),
    'pending',
    'telegram',
    COALESCE(p_employee_code, 'telegram'),
    v_city_id,
    v_region_id,
    p_city_name,
    p_region_name
  ) RETURNING id INTO v_ai_order_id;
  
  -- إرجاع النتيجة مع order_id و ai_order_id
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_ai_order_id,
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
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', '❌ حدث خطأ في معالجة الطلب'
    );
END;
$function$;