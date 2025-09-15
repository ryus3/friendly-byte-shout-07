-- إصلاح توليد رمز تليغرام تلقائياً عند الموافقة على الموظف الجديد
CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  counter INTEGER := 1;
BEGIN
  LOOP
    -- توليد رمز مكون من 3 أحرف + 4 أرقام
    new_code := 'EMP' || LPAD(counter::TEXT, 4, '0');
    
    -- فحص إذا كان الرمز موجود مسبقاً
    SELECT EXISTS(
      SELECT 1 FROM public.telegram_employee_codes 
      WHERE employee_code = new_code
    ) INTO code_exists;
    
    -- إذا لم يكن موجود، استخدمه
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    counter := counter + 1;
    
    -- حماية من حلقة لا نهائية
    IF counter > 9999 THEN
      -- استخدم رمز عشوائي كحل أخير
      new_code := 'EMP' || FLOOR(RANDOM() * 10000)::TEXT;
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- تحديث دالة handle_new_user لتشمل إنشاء رمز تليغرام تلقائياً
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  new_employee_code TEXT;
BEGIN
  -- توليد رمز موظف جديد
  new_employee_code := generate_employee_code();
  
  -- إنشاء profile للمستخدم الجديد
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    username, 
    email,
    employee_code,
    status
  ) VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email), 
    NEW.email,
    new_employee_code,
    'pending'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    employee_code = COALESCE(profiles.employee_code, EXCLUDED.employee_code),
    updated_at = now();

  -- إنشاء رمز تليغرام للموظف تلقائياً
  INSERT INTO public.telegram_employee_codes (
    user_id,
    employee_code,
    is_active
  ) VALUES (
    NEW.id,
    new_employee_code,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    employee_code = EXCLUDED.employee_code,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- دالة لتحديث حالة الموظف عند الموافقة عليه
CREATE OR REPLACE FUNCTION public.activate_employee_and_assign_role(
  p_user_id UUID,
  p_role_name TEXT DEFAULT 'sales_employee'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role_id UUID;
  v_employee_code TEXT;
  v_result JSONB;
BEGIN
  -- الحصول على معرف الدور
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE name = p_role_name AND is_active = true;

  IF v_role_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Role not found: ' || p_role_name
    );
  END IF;

  -- الحصول على رمز الموظف
  SELECT employee_code INTO v_employee_code
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- تفعيل حساب الموظف
  UPDATE public.profiles
  SET 
    status = 'active',
    updated_at = now()
  WHERE user_id = p_user_id;

  -- تعيين الدور للموظف
  INSERT INTO public.user_roles (user_id, role_id, is_active)
  VALUES (p_user_id, v_role_id, true)
  ON CONFLICT (user_id, role_id) DO UPDATE SET
    is_active = true,
    updated_at = now();

  -- التأكد من وجود رمز تليغرام
  IF NOT EXISTS (
    SELECT 1 FROM public.telegram_employee_codes 
    WHERE user_id = p_user_id
  ) THEN
    -- إنشاء رمز تليغرام إذا لم يكن موجود
    INSERT INTO public.telegram_employee_codes (
      user_id,
      employee_code,
      is_active
    ) VALUES (
      p_user_id,
      COALESCE(v_employee_code, generate_employee_code()),
      true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'employee_code', v_employee_code,
    'role_assigned', p_role_name,
    'message', 'تم تفعيل الموظف وتعيين الدور بنجاح'
  );
END;
$$;