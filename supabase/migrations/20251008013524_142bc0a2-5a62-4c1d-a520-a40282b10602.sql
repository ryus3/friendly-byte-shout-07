-- إصلاح دالة process_telegram_order لاستخراج الملاحظات داخلياً
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_telegram_chat_id bigint,
  p_employee_id uuid
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
  v_customer_city text;
  v_customer_province text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_product_items jsonb;
  v_notes text := NULL;
  v_city_id integer;
  v_region_id integer;
  v_resolved_city_name text;
  v_resolved_region_name text;
  v_location_confidence numeric := 0;
  v_ai_order_id uuid;
  v_lines text[];
  v_line text;
BEGIN
  -- 1. استخراج رقم الهاتف
  v_customer_phone := extractPhoneFromText(p_message_text);
  
  -- 2. استخراج اسم العميل (أول كلمة غير رقمية)
  v_customer_name := COALESCE(
    NULLIF(TRIM(regexp_replace(
      split_part(p_message_text, E'\n', 1),
      '[0-9+]', '', 'g'
    )), ''),
    'زبون تليغرام'
  );
  
  -- 3. استخراج العنوان الفعلي
  v_customer_address := extract_actual_address(p_message_text);
  
  -- 4. استخراج المدينة والمنطقة من النص
  SELECT city_id, region_id, resolved_city, resolved_region, confidence
  INTO v_city_id, v_region_id, v_resolved_city_name, v_resolved_region_name, v_location_confidence
  FROM smart_extract_location_from_order_text(p_message_text);
  
  v_customer_city := COALESCE(v_resolved_city_name, 'غير محدد');
  v_customer_province := COALESCE(v_resolved_region_name, 'غير محدد');
  
  -- 5. استخراج الملاحظات من سطر يبدأ بـ "ملاحظة" أو "ملاحظه"
  v_lines := string_to_array(p_message_text, E'\n');
  v_notes := NULL;
  
  FOREACH v_line IN ARRAY v_lines LOOP
    IF v_line ~* '^\s*(ملاحظة|ملاحظه)\s+' THEN
      v_notes := TRIM(regexp_replace(v_line, '^\s*(ملاحظة|ملاحظه)\s+', '', 'i'));
      EXIT;
    END IF;
  END LOOP;
  
  -- 6. استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  
  -- 7. حساب الإجمالي
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_product_items) AS item;
  
  -- 8. إنشاء سجل الطلب الذكي
  INSERT INTO ai_orders (
    source,
    original_text,
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    location_confidence,
    items,
    total_amount,
    delivery_fee,
    notes,
    processed_by,
    status,
    created_at,
    updated_at
  ) VALUES (
    'telegram',
    p_message_text,
    p_telegram_chat_id,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_city_id,
    v_region_id,
    v_resolved_city_name,
    v_resolved_region_name,
    v_location_confidence,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    v_notes,
    p_employee_id,
    'pending',
    now(),
    now()
  )
  RETURNING id INTO v_ai_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_province', v_customer_province,
    'total_amount', v_total_amount,
    'items_count', jsonb_array_length(v_product_items),
    'notes', v_notes
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'فشل في معالجة الطلب'
  );
END;
$function$;