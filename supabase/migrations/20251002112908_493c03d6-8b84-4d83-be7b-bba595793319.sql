-- تعديل process_telegram_order لإرجاع ai_order_id
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id bigint,
  p_original_text text,
  p_customer_phone text,
  p_customer_city text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id uuid;
  v_employee_code text;
  v_customer_name text := 'زبون تليغرام';
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_item jsonb;
  v_product_name text;
  v_is_available boolean;
  v_alternatives_message text;
  v_all_available boolean := true;
  v_response_message text := '';
  v_order_id uuid;
BEGIN
  -- الحصول على معرف الموظف من رقم الدردشة
  SELECT user_id, telegram_code INTO v_employee_id, v_employee_code
  FROM public.telegram_employee_codes
  WHERE telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;

  -- إذا لم يتم العثور على الموظف، استخدام المدير الافتراضي
  IF v_employee_id IS NULL THEN
    v_employee_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
    v_employee_code := 'RYU559';
  END IF;

  -- حساب المبلغ الإجمالي والتحقق من توفر المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_name := v_item->>'product_name';
    v_is_available := COALESCE((v_item->>'is_available')::boolean, false);
    v_alternatives_message := v_item->>'alternatives_message';
    
    IF NOT v_is_available THEN
      v_all_available := false;
      IF v_alternatives_message IS NOT NULL AND v_alternatives_message != '' THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', v_alternatives_message,
          'customer_city', p_customer_city
        );
      END IF;
    END IF;
    
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إذا كانت جميع المنتجات متوفرة، إنشاء الطلب
  IF v_all_available THEN
    -- إنشاء سجل في ai_orders وإرجاع ID
    INSERT INTO public.ai_orders (
      telegram_chat_id,
      original_text,
      customer_phone,
      customer_name,
      customer_city,
      items,
      total_amount,
      delivery_fee,
      status,
      source,
      created_by
    ) VALUES (
      p_telegram_chat_id,
      p_original_text,
      p_customer_phone,
      v_customer_name,
      p_customer_city,
      p_items,
      v_total_amount,
      v_delivery_fee,
      'pending',
      'telegram',
      v_employee_id::text
    ) RETURNING id INTO v_order_id;

    -- بناء رسالة النجاح
    v_response_message := '✅ تم استلام الطلب!' || E'\n\n';
    v_response_message := v_response_message || '🔹 ' || COALESCE(v_employee_code, 'ريوس') || E'\n';
    v_response_message := v_response_message || '📍 ' || p_customer_city || E'\n';
    v_response_message := v_response_message || '📱 الهاتف: ' || p_customer_phone || E'\n';
    
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_response_message := v_response_message || '❇️ ' || 
        (v_item->>'product_name') || ' (' || 
        (v_item->>'color') || ') ' || 
        (v_item->>'size') || ' × ' || 
        (v_item->>'quantity') || E'\n';
    END LOOP;
    
    v_response_message := v_response_message || '💵 المبلغ الإجمالي: ' || 
      to_char(v_total_amount + v_delivery_fee, 'FM999,999,999') || ' د.ع';

    RETURN jsonb_build_object(
      'success', true,
      'message', v_response_message,
      'customer_city', p_customer_city,
      'ai_order_id', v_order_id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ بعض المنتجات غير متوفرة',
      'customer_city', p_customer_city
    );
  END IF;
END;
$$;