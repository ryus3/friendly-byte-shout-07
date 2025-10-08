-- إصلاح دالة process_telegram_order الصحيحة (7 معاملات)
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer,
  p_region_id integer,
  p_city_name text,
  p_region_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_order_data jsonb;
  v_items jsonb;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_item jsonb;
  v_ai_order_id uuid;
BEGIN
  -- الحصول على معرف المستخدم من employee_code
  SELECT user_id INTO v_user_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_code_not_found',
      'message', 'رمز الموظف غير موجود أو غير نشط'
    );
  END IF;

  -- استخراج بيانات الطلب من الرسالة
  v_order_data := jsonb_build_object(
    'raw_message', p_message_text,
    'city_id', p_city_id,
    'region_id', p_region_id,
    'city_name', p_city_name,
    'region_name', p_region_name
  );

  -- استخراج المعلومات الأساسية
  v_customer_name := COALESCE(NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), ''), 'زبون تليغرام');
  v_customer_phone := public.extractphonefromtext(p_message_text);
  v_customer_address := public.extract_actual_address(p_message_text);

  -- استخراج المنتجات
  v_items := '[]'::jsonb;
  
  -- معالجة كل عنصر في قائمة المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    -- حساب السعر الإجمالي: السعر × الكمية
    v_total_amount := v_total_amount + ((v_item->>'price')::numeric * (v_item->>'quantity')::numeric);
  END LOOP;

  -- إنشاء سجل ai_order
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    resolved_city_name,
    city_id,
    region_id,
    resolved_region_name,
    items,
    total_amount,
    delivery_fee,
    order_data,
    status,
    source,
    created_by,
    processed_by
  ) VALUES (
    p_telegram_chat_id,
    p_message_text,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    p_city_name,
    p_city_name,
    p_city_id,
    p_region_id,
    p_region_name,
    v_items,
    v_total_amount,
    v_delivery_fee,
    v_order_data,
    'pending',
    'telegram',
    p_employee_code,
    v_user_id
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'total_amount', v_total_amount,
    'items_count', jsonb_array_length(v_items)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;