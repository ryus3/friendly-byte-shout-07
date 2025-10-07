-- استعادة دالة process_telegram_order الصحيحة من 7/10/2025 22:44
-- حذف النسخة الحالية الخاطئة
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

-- استعادة النسخة الصحيحة التي كانت تعمل
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
  v_employee_id uuid;
  v_default_customer_name text := 'ريوس';
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_notes text;
  v_items jsonb;
  v_order_id uuid;
  v_delivery_fee numeric := 5000;
  v_first_line text;
  v_first_word text;
  v_is_city boolean := false;
BEGIN
  -- 1. التحقق من رمز الموظف والحصول على user_id والاسم الافتراضي
  SELECT 
    tec.user_id,
    COALESCE(p.display_name, p.full_name, 'ريوس')
  INTO v_employee_id, v_default_customer_name
  FROM public.telegram_employee_codes tec
  LEFT JOIN public.profiles p ON p.id = tec.user_id
  WHERE tec.telegram_code = p_employee_code
    AND tec.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- 2. استخراج رقم الهاتف من النص
  v_customer_phone := public.extractphonefromtext(p_message_text);

  -- 3. استخراج السطر الأول والكلمة الأولى
  v_first_line := TRIM(SPLIT_PART(p_message_text, E'\n', 1));
  v_first_word := lower(TRIM(SPLIT_PART(v_first_line, ' ', 1)));

  -- 4. فحص إذا كانت الكلمة الأولى مدينة أو مرادف مدينة
  SELECT EXISTS(
    SELECT 1 FROM public.cities_cache WHERE lower(name) = v_first_word
    UNION
    SELECT 1 FROM public.city_aliases WHERE lower(normalized_name) = v_first_word
  ) INTO v_is_city;

  -- 5. تحديد اسم الزبون بناءً على الفحص
  IF v_is_city THEN
    v_customer_name := v_default_customer_name;
  ELSE
    v_customer_name := COALESCE(NULLIF(v_first_line, ''), v_default_customer_name);
  END IF;

  -- 6. استخراج العنوان التفصيلي بعد "قرب"
  v_customer_address := public.extract_actual_address(p_message_text);

  -- 7. استخراج الملاحظات (كل النص بعد السطر الثاني)
  v_notes := TRIM(SUBSTRING(p_message_text FROM POSITION(E'\n' IN p_message_text) + 1));

  -- 8. استخراج عناصر المنتجات من النص
  v_items := public.extract_product_items_from_text(p_message_text);

  -- 9. التحقق من وجود منتجات صالحة
  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم التعرف على أي منتج في الطلب'
    );
  END IF;

  -- 10. إنشاء سجل AI order
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    items,
    notes,
    original_text,
    telegram_chat_id,
    processed_by,
    processed_at,
    created_by,
    delivery_fee,
    total_amount,
    status,
    source
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    p_city_name,
    v_customer_address,
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    v_items,
    v_notes,
    p_message_text,
    p_telegram_chat_id,
    v_employee_id,
    now(),
    v_employee_id,
    v_delivery_fee,
    (
      SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
      FROM jsonb_array_elements(v_items) AS item
    ) + v_delivery_fee,
    'pending',
    'telegram'
  )
  RETURNING id INTO v_order_id;

  -- 11. إرجاع النتيجة بنجاح مع order_id
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_order_id,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'city_name', p_city_name,
    'region_name', p_region_name,
    'items', v_items,
    'notes', v_notes,
    'delivery_fee', v_delivery_fee,
    'message', format('تم استلام الطلب! %s - %s - %s', v_customer_name, p_city_name, p_region_name)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;