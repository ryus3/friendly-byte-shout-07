-- Fix RYU559 telegram_chat_id from scientific notation to proper bigint
UPDATE employee_telegram_codes 
SET telegram_chat_id = 499943724
WHERE telegram_code = 'RYU559' AND user_id = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;

-- Create RPC function for employee linking
CREATE OR REPLACE FUNCTION public.link_employee_telegram_code(
  p_employee_code text,
  p_chat_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
  v_user_id uuid;
  v_employee_name text;
BEGIN
  -- Check if employee code exists
  SELECT user_id INTO v_user_id
  FROM employee_telegram_codes
  WHERE telegram_code = p_employee_code AND is_active = true;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير موجود'
    );
  END IF;
  
  -- Get employee name from profiles
  SELECT COALESCE(full_name, email, 'موظف') INTO v_employee_name
  FROM auth.users 
  WHERE id = v_user_id;
  
  -- Update telegram_chat_id
  UPDATE employee_telegram_codes
  SET telegram_chat_id = p_chat_id,
      linked_at = now(),
      updated_at = now()
  WHERE telegram_code = p_employee_code;
  
  RETURN jsonb_build_object(
    'success', true,
    'employee_code', p_employee_code,
    'employee_name', v_employee_name,
    'chat_id', p_chat_id
  );
END;
$$;