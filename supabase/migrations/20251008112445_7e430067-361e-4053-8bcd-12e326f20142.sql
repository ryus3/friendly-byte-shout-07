-- إصلاح استدعاء extract_product_items_from_text في process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_chat_id bigint,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_product_items jsonb;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_employee_id uuid;
BEGIN
  -- تحديد معرف الموظف
  v_employee_id := COALESCE(p_employee_id, '91484496-b887-44f7-9e5d-be9db5567604'::uuid);

  -- استخراج معلومات العميل
  v_customer_name := COALESCE(NULLIF(TRIM(regexp_replace(p_message_text, '.*الاسم[:\s]*([^\n]+).*', '\1', 'i')), ''), 'زبون تليغرام');
  v_customer_phone := extractphonefromtext(p_message_text);
  v_customer_address := extract_actual_address(p_message_text);
  
  -- استخراج المدينة والمحافظة
  v_customer_city := NULLIF(TRIM(regexp_replace(p_message_text, '.*(?:المدينة|المحافظة)[:\s]*([^\n]+).*', '\1', 'i')), '');
  v_customer_province := NULLIF(TRIM(regexp_replace(p_message_text, '.*المحافظة[:\s]*([^\n]+).*', '\1', 'i')), '');

  -- استخراج المنتجات باستخدام الدالة الذكية (بدون معامل v_employee_id)
  v_product_items := extract_product_items_from_text(p_message_text);

  -- حساب المجموع
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_product_items) AS item;

  -- إنشاء سجل الطلب الذكي
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    items,
    total_amount,
    delivery_fee,
    order_data,
    original_text,
    telegram_chat_id,
    created_by,
    status,
    source
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_city', v_customer_city,
      'customer_province', v_customer_province,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee
    ),
    p_message_text,
    p_chat_id,
    v_employee_id::text,
    'pending',
    'telegram'
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE 'تم إنشاء طلب ذكي جديد: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'items_count', jsonb_array_length(v_product_items),
    'total_amount', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'خطأ في معالجة الطلب: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;