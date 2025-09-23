-- المرحلة 1 و 2: إصلاح بيانات RYU559 وإنشاء RPC function للربط

-- إجبار تحديث telegram_chat_id للموظف RYU559
UPDATE public.employee_telegram_codes 
SET telegram_chat_id = 499943724,
    linked_at = now(),
    updated_at = now()
WHERE telegram_code = 'RYU559';

-- إنشاء أو تحديث RPC function لربط الموظف بـ chat_id
CREATE OR REPLACE FUNCTION public.link_employee_telegram_code(
  p_employee_code text,
  p_chat_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid;
  v_full_name text;
  v_employee_code text;
  v_existing_chat_id bigint;
BEGIN
  -- البحث عن الموظف بالكود
  SELECT user_id, telegram_chat_id INTO v_user_id, v_existing_chat_id
  FROM public.employee_telegram_codes
  WHERE telegram_code = p_employee_code AND is_active = true;
  
  -- إذا لم يوجد الكود
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_code_not_found',
      'message', 'كود الموظف غير موجود'
    );
  END IF;
  
  -- إذا كان مربوط مسبقاً بـ chat_id آخر
  IF v_existing_chat_id IS NOT NULL AND v_existing_chat_id != p_chat_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_linked',
      'message', 'هذا الكود مربوط مسبقاً بحساب تليغرام آخر'
    );
  END IF;
  
  -- التحقق من عدم ربط chat_id بموظف آخر
  SELECT telegram_code INTO v_employee_code
  FROM public.employee_telegram_codes
  WHERE telegram_chat_id = p_chat_id AND telegram_code != p_employee_code AND is_active = true;
  
  IF v_employee_code IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'chat_already_linked',
      'message', 'حسابك التليغرام مربوط مسبقاً بكود موظف آخر: ' || v_employee_code
    );
  END IF;
  
  -- ربط الموظف
  UPDATE public.employee_telegram_codes
  SET telegram_chat_id = p_chat_id,
      linked_at = COALESCE(linked_at, now()),
      updated_at = now()
  WHERE telegram_code = p_employee_code;
  
  -- الحصول على اسم الموظف
  SELECT u.full_name INTO v_full_name
  FROM auth.users u
  WHERE u.id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'user_id', v_user_id,
      'full_name', COALESCE(v_full_name, 'موظف'),
      'employee_code', p_employee_code,
      'telegram_chat_id', p_chat_id
    ),
    'message', 'تم ربط الكود بنجاح'
  );
END;
$$;

-- إنشاء RPC function للحصول على بيانات الموظف بـ chat_id
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_chat_id(
  p_chat_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_employee_data jsonb;
BEGIN
  SELECT jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'user_id', etc.user_id,
      'full_name', COALESCE(u.full_name, 'موظف'),
      'employee_code', etc.telegram_code,
      'telegram_chat_id', etc.telegram_chat_id,
      'is_active', etc.is_active,
      'linked_at', etc.linked_at
    )
  ) INTO v_employee_data
  FROM public.employee_telegram_codes etc
  LEFT JOIN auth.users u ON etc.user_id = u.id
  WHERE etc.telegram_chat_id = p_chat_id 
    AND etc.is_active = true;
  
  IF v_employee_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'لم يتم العثور على موظف مربوط بهذا الحساب'
    );
  END IF;
  
  RETURN v_employee_data;
END;
$$;