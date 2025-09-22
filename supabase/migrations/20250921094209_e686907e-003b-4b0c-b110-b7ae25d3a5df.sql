-- إصلاح دالة process_telegram_order لتستخدم النظام الصحيح للرموز
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id bigint,
  p_order_data jsonb,
  p_original_text text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_employee_info jsonb;
  v_order_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_total_amount numeric := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  -- الحصول على معلومات الموظف من النظام الصحيح
  SELECT jsonb_build_object(
    'user_id', tec.user_id,
    'employee_code', tec.employee_code,
    'full_name', p.full_name,
    'username', p.username,
    'telegram_chat_id', tec.telegram_chat_id
  ) INTO v_employee_info
  FROM public.telegram_employee_codes tec
  LEFT JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.telegram_chat_id = p_chat_id 
    AND tec.is_active = true;

  -- التحقق من وجود الموظف
  IF v_employee_info IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير مرتبط بهذا الحساب. الرجاء ربط الحساب أولاً',
      'chat_id', p_chat_id
    );
  END IF;

  -- استخراج بيانات العميل
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);

  -- إنشاء الطلب الذكي
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    items,
    order_data,
    original_text,
    source,
    status,
    created_by
  ) VALUES (
    p_chat_id,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_total_amount,
    v_items,
    p_order_data,
    p_original_text,
    'telegram',
    'pending',
    v_employee_info->>'user_id'
  ) RETURNING id INTO v_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'employee', v_employee_info,
    'message', 'تم إنشاء الطلب بنجاح',
    'customer_name', v_customer_name,
    'total_amount', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'database_error',
    'message', 'خطأ في قاعدة البيانات: ' || SQLERRM,
    'chat_id', p_chat_id,
    'employee_check', v_employee_info IS NOT NULL
  );
END;
$$;