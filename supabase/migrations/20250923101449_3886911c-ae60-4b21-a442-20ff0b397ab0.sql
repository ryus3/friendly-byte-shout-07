-- Fix telegram_employee_codes table structure and data issues
-- First, ensure telegram_chat_id column is properly defined as bigint
ALTER TABLE public.telegram_employee_codes 
ALTER COLUMN telegram_chat_id TYPE bigint;

-- Add index on telegram_chat_id for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_employee_codes_chat_id 
ON public.telegram_employee_codes(telegram_chat_id) 
WHERE telegram_chat_id IS NOT NULL;

-- Fix any chat_ids that might be stored in scientific notation
-- Convert scientific notation back to proper bigint values
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = NULL 
WHERE telegram_chat_id IS NOT NULL 
  AND telegram_chat_id::text ~ '^[0-9\.]+e\+[0-9]+$';

-- Add constraint to ensure employee_code uniqueness
ALTER TABLE public.telegram_employee_codes 
ADD CONSTRAINT unique_employee_code 
UNIQUE (employee_code);

-- Update the link function to handle bigint properly
CREATE OR REPLACE FUNCTION public.link_telegram_user(p_employee_code text, p_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_employee_info jsonb;
BEGIN
  -- البحث عن المستخدم باستخدام employee_code في telegram_employee_codes
  SELECT tec.user_id INTO v_user_id
  FROM public.telegram_employee_codes tec
  WHERE tec.employee_code = p_employee_code
    AND tec.is_active = true;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_code',
      'message', 'كود الموظف غير صحيح أو غير فعال'
    );
  END IF;

  -- التحقق من عدم ربط هذا الكود مسبقاً بحساب تليغرام آخر
  IF EXISTS (
    SELECT 1 FROM public.telegram_employee_codes 
    WHERE employee_code = p_employee_code 
      AND telegram_chat_id IS NOT NULL 
      AND telegram_chat_id != p_chat_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_linked',
      'message', 'هذا الكود مربوط بحساب تليغرام آخر'
    );
  END IF;

  -- ربط الحساب بشكل صحيح
  UPDATE public.telegram_employee_codes
  SET 
    telegram_chat_id = p_chat_id,
    linked_at = now(),
    updated_at = now()
  WHERE employee_code = p_employee_code;

  -- الحصول على معلومات الموظف
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'full_name', p.full_name,
    'employee_code', tec.employee_code,
    'role', r.name,
    'role_title', r.display_name
  ) INTO v_employee_info
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id AND ur.is_active = true
  LEFT JOIN public.roles r ON ur.role_id = r.id
  WHERE tec.employee_code = p_employee_code;

  RETURN jsonb_build_object(
    'success', true,
    'employee', v_employee_info,
    'message', 'تم ربط الحساب بنجاح'
  );
END;
$function$;

-- Update get_employee_by_telegram_id to handle bigint properly
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'full_name', p.full_name,
    'role', r.name,
    'role_title', r.display_name,
    'employee_code', tec.employee_code
  ) INTO v_employee_info
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id AND ur.is_active = true
  LEFT JOIN public.roles r ON ur.role_id = r.id
  WHERE tec.telegram_chat_id = p_chat_id
    AND tec.is_active = true;

  IF v_employee_info IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'الموظف غير مربوط بهذا الحساب'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'employee', v_employee_info
  );
END;
$function$;