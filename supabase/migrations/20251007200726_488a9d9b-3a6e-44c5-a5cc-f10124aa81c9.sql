-- حذف الدالة الخاطئة التي تم إنشاؤها بالخطأ
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, text, text, text, text, text);

-- تعديل الدالة الصحيحة فقط (7 معاملات تبدأ بـ p_employee_code)
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer DEFAULT NULL::integer,
  p_region_id integer DEFAULT NULL::integer,
  p_city_name text DEFAULT NULL::text,
  p_region_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_phone text;
  v_name text;
  v_address text;
  v_items jsonb;
  v_total numeric := 0;
  v_result jsonb;
  v_notes text := NULL;
  v_line text;
BEGIN
  -- التحقق من صحة رمز الموظف
  SELECT user_id INTO v_user_id
  FROM public.telegram_employee_codes
  WHERE telegram_code = p_employee_code 
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- استخراج رقم الهاتف
  v_phone := public.extractphonefromtext(p_message_text);
  
  -- استخراج الاسم من النص (أول سطر غالباً)
  v_name := TRIM(SPLIT_PART(p_message_text, E'\n', 1));
  IF v_name = '' OR LENGTH(v_name) > 100 THEN
    v_name := 'زبون تليغرام';
  END IF;

  -- استخراج العنوان
  v_address := public.extract_actual_address(p_message_text);

  -- استخراج المنتجات
  v_items := public.extract_product_items_from_text(p_message_text);

  -- حساب المجموع
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total
  FROM jsonb_array_elements(v_items) AS item;

  -- استخراج الملاحظات من النص
  DECLARE
    v_lines text[];
  BEGIN
    v_lines := string_to_array(p_message_text, E'\n');
    FOREACH v_line IN ARRAY v_lines
    LOOP
      IF LOWER(v_line) LIKE '%ملاحظة%' OR LOWER(v_line) LIKE '%ملاحظه%' THEN
        v_notes := TRIM(v_line);
        EXIT;
      END IF;
    END LOOP;
  END;

  -- إدراج الطلب في ai_orders
  INSERT INTO public.ai_orders (
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
    notes
  ) VALUES (
    v_name,
    v_phone,
    v_address,
    COALESCE(p_city_name, 'غير محدد'),
    'العراق',
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    v_items,
    v_total,
    5000,
    p_message_text,
    p_telegram_chat_id,
    v_user_id::text,
    'pending',
    'telegram',
    v_notes
  )
  RETURNING jsonb_build_object(
    'success', true,
    'order_id', id,
    'customer_name', customer_name,
    'customer_phone', customer_phone,
    'customer_address', customer_address,
    'customer_city', customer_city,
    'items', items,
    'total_amount', total_amount,
    'delivery_fee', delivery_fee,
    'city_id', city_id,
    'region_id', region_id,
    'resolved_city_name', resolved_city_name,
    'resolved_region_name', resolved_region_name,
    'notes', notes
  ) INTO v_result;

  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;