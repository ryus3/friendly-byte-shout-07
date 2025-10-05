-- إصلاح نهائي لدالة process_telegram_order باستخدام الجدول الصحيح

-- حذف النسخة الخاطئة
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

-- إنشاء النسخة الصحيحة باستخدام employee_telegram_codes (الجدول الصحيح)
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_region_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_default_customer_name text;
  v_items jsonb;
  v_ai_order_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_item jsonb;
BEGIN
  -- الحصول على معلومات الموظف من employee_telegram_codes (الجدول الصحيح)
  SELECT 
    etc.user_id,
    COALESCE(p.full_name, 'موظف تليغرام'),
    p.default_customer_name
  INTO v_employee_id, v_employee_name, v_default_customer_name
  FROM public.employee_telegram_codes etc
  LEFT JOIN public.profiles p ON p.user_id = etc.user_id
  WHERE etc.telegram_code = p_employee_code
    AND etc.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'رمز الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  -- استخراج المنتجات من النص
  v_items := extract_product_items_from_text(p_message_text);

  -- حساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- استخراج معلومات الزبون
  v_customer_phone := extractphonefromtext(p_message_text);
  v_customer_address := extract_actual_address(p_message_text);
  v_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');

  -- إنشاء سجل ai_order
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    items,
    total_amount,
    delivery_fee,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    source,
    status,
    created_by,
    original_text,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    v_items,
    v_total_amount,
    v_delivery_fee,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    p_city_name,
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    'telegram',
    'pending',
    v_employee_id,
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'employee_name', v_employee_name,
      'telegram_chat_id', p_telegram_chat_id
    )
  )
  RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_name', v_employee_name,
    'customer_name', v_customer_name,
    'total_amount', v_total_amount,
    'items', v_items
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'حدث خطأ في معالجة الطلب'
    );
END;
$function$;