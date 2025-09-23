-- Fix corrupted telegram_chat_id values and update webhook settings
-- Convert scientific notation to proper bigint values
UPDATE telegram_employee_codes 
SET telegram_chat_id = 499943724 
WHERE employee_code = 'RYU559' AND user_id = '91484496-b887-44f7-9e5d-be9db5567604';

UPDATE telegram_employee_codes 
SET telegram_chat_id = 1998984107 
WHERE employee_code = 'AHM435' AND user_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4';

-- Update webhook settings to point to telegram-bot-alwaseet
UPDATE settings 
SET value = jsonb_set(
  value,
  '{webhook_url}',
  '"https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot-alwaseet"'
)
WHERE key = 'telegram_bot_config';

-- Also ensure the get_employee_by_telegram_id function is optimized
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_telegram_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  employee_data jsonb;
BEGIN
  -- Direct lookup with proper join
  SELECT jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'user_id', etc.user_id,
      'full_name', COALESCE(p.full_name, 'موظف'),
      'employee_code', etc.employee_code,
      'telegram_chat_id', etc.telegram_chat_id,
      'is_active', etc.is_active
    )
  ) INTO employee_data
  FROM public.telegram_employee_codes etc
  LEFT JOIN public.profiles p ON p.user_id = etc.user_id
  WHERE etc.telegram_chat_id = p_telegram_chat_id
    AND etc.is_active = true
  LIMIT 1;
  
  IF employee_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'employee', null,
      'error', 'Employee not found for chat_id: ' || p_telegram_chat_id
    );
  END IF;
  
  RETURN employee_data;
END;
$function$;