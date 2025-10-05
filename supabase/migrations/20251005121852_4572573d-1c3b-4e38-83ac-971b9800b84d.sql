-- إصلاح دالة process_telegram_order لحفظ username بدلاً من email
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_telegram_chat_id BIGINT,
  p_order_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
  v_employee_name TEXT;
  v_customer_name TEXT;
  v_default_customer_name TEXT := 'زبون تليغرام';
  v_ai_order_id UUID;
BEGIN
  -- البحث عن الموظف المرتبط برقم الشات
  SELECT u.user_id, u.username
  INTO v_employee_id, v_employee_name
  FROM public.employee_telegram_codes etc
  JOIN public.profiles u ON u.user_id = etc.user_id
  WHERE etc.telegram_chat_id = p_telegram_chat_id
    AND etc.is_active = true
  LIMIT 1;

  -- إذا لم نجد موظف، استخدم المدير الافتراضي
  IF v_employee_id IS NULL THEN
    SELECT user_id, username
    INTO v_employee_id, v_employee_name
    FROM public.profiles
    WHERE user_id = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
    LIMIT 1;
  END IF;

  -- تحديد الاسم الافتراضي للزبون بناءً على اسم الموظف
  IF v_employee_name IS NOT NULL THEN
    v_default_customer_name := 'زبون ' || v_employee_name;
  END IF;

  -- استخراج اسم الزبون من البيانات أو استخدام الافتراضي
  v_customer_name := COALESCE(
    NULLIF(TRIM(p_order_data->>'customer_name'), ''),
    v_default_customer_name
  );

  -- إنشاء سجل الطلب الذكي
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    order_data,
    items,
    total_amount,
    delivery_fee,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    source,
    status,
    created_by,
    original_text,
    city_id,
    region_id,
    location_confidence,
    location_suggestions,
    resolved_city_name,
    resolved_region_name
  ) VALUES (
    p_telegram_chat_id,
    p_order_data,
    COALESCE(p_order_data->'items', '[]'::jsonb),
    COALESCE((p_order_data->>'total_amount')::numeric, 0),
    COALESCE((p_order_data->>'delivery_fee')::numeric, 5000),
    v_customer_name,
    p_order_data->>'customer_phone',
    p_order_data->>'customer_address',
    p_order_data->>'customer_city',
    p_order_data->>'customer_province',
    'telegram',
    'pending',
    COALESCE(v_employee_name, v_employee_id::text),
    p_order_data->>'original_text',
    COALESCE((p_order_data->>'city_id')::integer, NULL),
    COALESCE((p_order_data->>'region_id')::integer, NULL),
    COALESCE((p_order_data->>'location_confidence')::numeric, 0),
    COALESCE(p_order_data->'location_suggestions', '[]'::jsonb),
    p_order_data->>'resolved_city_name',
    p_order_data->>'resolved_region_name'
  )
  RETURNING id INTO v_ai_order_id;

  RAISE NOTICE 'تم إنشاء طلب ذكي جديد: % - الزبون: % - الموظف: %', 
    v_ai_order_id, v_customer_name, COALESCE(v_employee_name, 'المدير الافتراضي');

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_id', v_employee_id,
    'employee_name', v_employee_name,
    'customer_name', v_customer_name
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'خطأ في معالجة طلب التليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- تحديث السجلات الموجودة التي تحتوي على email بدلاً من username
UPDATE public.ai_orders
SET created_by = 'ryus'
WHERE created_by = 'ryusbrand@gmail.com'
  AND source = 'telegram';