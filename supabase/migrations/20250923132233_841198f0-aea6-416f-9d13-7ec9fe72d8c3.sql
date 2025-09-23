-- Fix RYU559 telegram_chat_id more explicitly 
UPDATE employee_telegram_codes 
SET telegram_chat_id = 499943724::bigint
WHERE telegram_code = 'RYU559';

-- Create RPC function to find employee by telegram chat id
CREATE OR REPLACE FUNCTION public.find_employee_by_telegram_chat_id(
  p_chat_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
  v_employee_record record;
BEGIN
  -- Find employee by chat_id
  SELECT 
    etc.user_id,
    etc.telegram_code,
    etc.telegram_chat_id,
    etc.is_active,
    etc.linked_at,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'موظف') as full_name
  INTO v_employee_record
  FROM employee_telegram_codes etc
  LEFT JOIN auth.users au ON etc.user_id = au.id
  WHERE etc.telegram_chat_id = p_chat_id 
    AND etc.is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على موظف مرتبط بهذا الحساب'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'employee_code', v_employee_record.telegram_code,
    'full_name', v_employee_record.full_name,
    'user_id', v_employee_record.user_id,
    'chat_id', v_employee_record.telegram_chat_id,
    'linked_at', v_employee_record.linked_at
  );
END;
$$;