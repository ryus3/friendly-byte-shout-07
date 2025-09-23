-- Fix the function to use correct profile columns
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_telegram_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  employee_data jsonb;
BEGIN
  SELECT jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'user_id', p.user_id,
      'full_name', p.full_name,
      'employee_code', etc.employee_code,
      'telegram_chat_id', etc.telegram_chat_id
    )
  ) INTO employee_data
  FROM public.telegram_employee_codes etc
  JOIN public.profiles p ON p.user_id = etc.user_id
  WHERE etc.telegram_chat_id = p_telegram_chat_id
    AND etc.is_active = true
  LIMIT 1;
  
  IF employee_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'employee', null);
  END IF;
  
  RETURN employee_data;
END;
$function$;