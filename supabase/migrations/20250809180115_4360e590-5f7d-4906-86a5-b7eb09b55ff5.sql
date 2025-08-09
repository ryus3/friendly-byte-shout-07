-- Fix Telegram linking and lookup functions to use the correct table/columns
-- 1) link_telegram_user should match codes in employee_telegram_codes.telegram_code
-- 2) get_employee_by_telegram_id should return the code from employee_telegram_codes.telegram_code

-- Replace link_telegram_user
CREATE OR REPLACE FUNCTION public.link_telegram_user(
  p_employee_code text,
  p_telegram_chat_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Normalize input
  p_employee_code := UPPER(TRIM(p_employee_code));

  UPDATE public.employee_telegram_codes AS etc
  SET 
    telegram_chat_id = p_telegram_chat_id,
    linked_at = now(),
    updated_at = now(),
    is_active = true
  WHERE UPPER(etc.telegram_code) = p_employee_code
    AND etc.is_active = true;
  
  RETURN FOUND;
END;
$$;

-- Replace get_employee_by_telegram_id to read from employee_telegram_codes.telegram_code
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(
  p_telegram_chat_id bigint
)
RETURNS TABLE(
  user_id uuid,
  employee_code text,
  full_name text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    etc.telegram_code AS employee_code,
    p.full_name,
    COALESCE(r.name, 'employee') AS role
  FROM public.employee_telegram_codes AS etc
  JOIN public.profiles AS p 
    ON p.user_id = etc.user_id
  LEFT JOIN public.user_roles ur 
    ON ur.user_id = p.user_id AND ur.is_active = true
  LEFT JOIN public.roles r 
    ON r.id = ur.role_id AND r.is_active = true
  WHERE etc.telegram_chat_id = p_telegram_chat_id
    AND etc.is_active = true
    AND p.is_active = true
  LIMIT 1;
END;
$$;

-- Helpful index for fast code lookup if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_employee_telegram_codes_code'
  ) THEN
    CREATE INDEX idx_employee_telegram_codes_code 
      ON public.employee_telegram_codes (telegram_code);
  END IF;
END $$;