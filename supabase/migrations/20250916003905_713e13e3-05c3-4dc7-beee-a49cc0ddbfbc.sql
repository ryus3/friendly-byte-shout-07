-- إسقاط وإعادة إنشاء function approve_employee_complete بطريقة صحيحة
DROP FUNCTION IF EXISTS public.approve_employee_complete(uuid, text);

CREATE OR REPLACE FUNCTION public.approve_employee_complete(p_user_id uuid, p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_telegram_code text;
  v_sales_role_id uuid := '720ec508-376a-4538-9624-820cc7bdd671';
BEGIN
  -- 1. تحديث حالة المستخدم إلى نشط
  UPDATE public.profiles
  SET status = 'active',
      updated_at = now()
  WHERE user_id = p_user_id;

  -- 2. إنشاء رمز التليغرام الموحد
  SELECT generate_unified_telegram_code(p_full_name) INTO v_telegram_code;

  -- 3. إنشاء سجل في telegram_employee_codes
  INSERT INTO public.telegram_employee_codes (
    user_id,
    employee_code,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_telegram_code,
    true,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    employee_code = EXCLUDED.employee_code,
    is_active = true,
    updated_at = now();

  -- 4. إضافة دور موظف المبيعات (مع اسم العمود الصحيح)
  INSERT INTO public.user_roles (
    user_id,
    role_id,
    is_active,
    assigned_at,
    assigned_by
  ) VALUES (
    p_user_id,
    v_sales_role_id,
    true,
    now(),
    auth.uid()
  )
  ON CONFLICT (user_id, role_id) DO UPDATE SET
    is_active = true,
    assigned_at = now(),
    assigned_by = auth.uid();

  -- 5. إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'telegram_code', v_telegram_code,
    'status', 'active',
    'role_assigned', 'sales_employee',
    'message', 'تم الموافقة على الموظف بنجاح وأصبح موظف حقيقي'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'حدث خطأ أثناء الموافقة على الموظف'
    );
END;
$function$;