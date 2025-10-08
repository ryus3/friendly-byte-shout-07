-- حذف جميع النسخ القديمة والمكررة من process_telegram_order
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, uuid);
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

-- إنشاء الدالة النهائية الصحيحة مع معامل واحد لـ extract_product_items_from_text
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
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_product_items jsonb;
  v_order_id uuid;
  v_ai_order_id uuid;
  v_final_city_id integer;
  v_final_region_id integer;
  v_final_city_name text;
  v_final_region_name text;
  v_location_confidence numeric := 0;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_notes text := NULL;
  v_notes_start_pos integer;
  v_notes_keywords text[] := ARRAY['ملاحظة', 'ملاحظه', 'note', 'ملاحظات', 'تنبيه', 'مهم'];
  v_keyword text;
  v_clean_message text;
BEGIN
  -- الحصول على معرف الموظف من employee_code
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'لم يتم العثور على الموظف بهذا الكود: ' || p_employee_code
    );
  END IF;

  -- نسخة نظيفة من الرسالة للمعالجة
  v_clean_message := p_message_text;

  -- استخراج الملاحظات الداخلية
  FOREACH v_keyword IN ARRAY v_notes_keywords
  LOOP
    v_notes_start_pos := POSITION(v_keyword IN LOWER(v_clean_message));
    IF v_notes_start_pos > 0 THEN
      v_notes := TRIM(SUBSTRING(v_clean_message FROM v_notes_start_pos + LENGTH(v_keyword)));
      v_clean_message := TRIM(SUBSTRING(v_clean_message FROM 1 FOR v_notes_start_pos - 1));
      EXIT;
    END IF;
  END LOOP;

  -- استخراج اسم الزبون
  v_customer_name := COALESCE(
    NULLIF(TRIM(SPLIT_PART(SPLIT_PART(v_clean_message, E'\n', 1), ':', 2)), ''),
    'زبون تليغرام'
  );

  -- معالجة المدينة والمنطقة
  IF p_city_id IS NOT NULL THEN
    v_final_city_id := p_city_id;
    v_final_city_name := p_city_name;
    v_location_confidence := 1.0;
  ELSE
    v_final_city_id := NULL;
    v_final_city_name := NULL;
    v_location_confidence := 0;
  END IF;

  IF p_region_id IS NOT NULL THEN
    v_final_region_id := p_region_id;
    v_final_region_name := p_region_name;
  ELSE
    v_final_region_id := NULL;
    v_final_region_name := NULL;
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractPhoneFromText(v_clean_message);

  -- استخراج العنوان
  v_customer_address := extract_actual_address(v_clean_message);
  IF v_final_city_name IS NOT NULL THEN
    v_customer_address := v_final_city_name || 
      CASE WHEN v_final_region_name IS NOT NULL 
           THEN ' - ' || v_final_region_name || ' - ' 
           ELSE ' - ' 
      END || 
      COALESCE(v_customer_address, 'لم يُحدد');
  END IF;

  -- استخراج المنتجات (معامل واحد فقط)
  v_product_items := extract_product_items_from_text(p_message_text);

  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_product_items) AS item;

  -- إنشاء سجل في ai_orders
  INSERT INTO public.ai_orders (
    original_text,
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    city_id,
    resolved_city_name,
    region_id,
    resolved_region_name,
    location_confidence,
    items,
    total_amount,
    delivery_fee,
    status,
    source,
    created_by,
    notes,
    order_data
  ) VALUES (
    p_message_text,
    p_telegram_chat_id,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_final_city_name,
    v_final_city_id,
    v_final_city_name,
    v_final_region_id,
    v_final_region_name,
    v_location_confidence,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    CASE 
      WHEN v_final_city_id IS NOT NULL AND v_product_items IS NOT NULL 
           AND jsonb_array_length(v_product_items) > 0 
      THEN 'ready'
      ELSE 'pending'
    END,
    'telegram',
    p_employee_code,
    v_notes,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'telegram_chat_id', p_telegram_chat_id,
      'processed_at', now()
    )
  )
  RETURNING id INTO v_ai_order_id;

  -- إنشاء طلب نهائي إذا كانت البيانات كاملة
  IF v_final_city_id IS NOT NULL 
     AND v_product_items IS NOT NULL 
     AND jsonb_array_length(v_product_items) > 0 THEN
    
    INSERT INTO public.orders (
      customer_name,
      customer_phone,
      customer_address,
      customer_city,
      total_amount,
      final_amount,
      delivery_fee,
      status,
      created_by,
      notes,
      order_data
    ) VALUES (
      v_customer_name,
      v_customer_phone,
      v_customer_address,
      v_final_city_name,
      v_total_amount,
      v_total_amount + v_delivery_fee,
      v_delivery_fee,
      'pending',
      v_employee_id,
      v_notes,
      jsonb_build_object(
        'source', 'telegram',
        'ai_order_id', v_ai_order_id,
        'telegram_chat_id', p_telegram_chat_id
      )
    )
    RETURNING id INTO v_order_id;

    -- تحديث ai_orders بمعرف الطلب النهائي
    UPDATE public.ai_orders
    SET related_order_id = v_order_id,
        processed_by = v_employee_id,
        processed_at = now(),
        status = 'processed'
    WHERE id = v_ai_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'items_count', COALESCE(jsonb_array_length(v_product_items), 0),
    'total_amount', v_total_amount,
    'city', v_final_city_name,
    'region', v_final_region_name,
    'notes', v_notes,
    'status', CASE 
      WHEN v_order_id IS NOT NULL THEN 'order_created'
      ELSE 'ai_order_created'
    END
  );
END;
$function$;