-- حذف الدوال الخاطئة وإعادة إنشائها بالشكل الصحيح
DROP FUNCTION IF EXISTS public.link_telegram_user(text, bigint);
DROP FUNCTION IF EXISTS public.get_employee_by_telegram_id(bigint);

-- إنشاء دالة link_telegram_user لتقرأ من telegram_employee_codes
CREATE OR REPLACE FUNCTION public.link_telegram_user(p_employee_code text, p_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  -- ربط الحساب
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
$$;

-- إنشاء دالة get_employee_by_telegram_id لتقرأ من telegram_employee_codes
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;