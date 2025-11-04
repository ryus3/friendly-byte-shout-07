-- إصلاح دالة ربط رمز التليغرام (استخدام profiles بدلاً من auth.users)
CREATE OR REPLACE FUNCTION public.link_employee_telegram_code(
  p_employee_code text, 
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
  v_user_id uuid;
  v_employee_name text;
  v_is_active boolean;
  v_existing_chat_id bigint;
BEGIN
  -- التحقق من وجود الرمز وحالته
  SELECT user_id, is_active, telegram_chat_id 
  INTO v_user_id, v_is_active, v_existing_chat_id
  FROM employee_telegram_codes
  WHERE telegram_code = p_employee_code;
  
  -- التحقق من وجود الرمز
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رمز الموظف غير صحيح'
    );
  END IF;
  
  -- التحقق من نشاط الرمز
  IF v_is_active = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رمز الموظف غير نشط'
    );
  END IF;
  
  -- التحقق إذا كان الرمز مربوط مسبقاً
  IF v_existing_chat_id IS NOT NULL THEN
    -- جلب اسم الموظف
    SELECT COALESCE(full_name, username, 'موظف') INTO v_employee_name
    FROM public.profiles 
    WHERE user_id = v_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_linked', true,
      'employee_code', p_employee_code,
      'employee_name', COALESCE(v_employee_name, 'موظف'),
      'chat_id', v_existing_chat_id
    );
  END IF;
  
  -- جلب اسم الموظف من profiles (وليس auth.users)
  SELECT COALESCE(full_name, username, 'موظف') INTO v_employee_name
  FROM public.profiles 
  WHERE user_id = v_user_id;
  
  -- تحديث telegram_chat_id (ربط جديد)
  UPDATE employee_telegram_codes
  SET 
    telegram_chat_id = p_chat_id,
    linked_at = now(),
    updated_at = now()
  WHERE telegram_code = p_employee_code;
  
  RETURN jsonb_build_object(
    'success', true,
    'already_linked', false,
    'employee_code', p_employee_code,
    'employee_name', COALESCE(v_employee_name, 'موظف'),
    'chat_id', p_chat_id
  );
END;
$$;