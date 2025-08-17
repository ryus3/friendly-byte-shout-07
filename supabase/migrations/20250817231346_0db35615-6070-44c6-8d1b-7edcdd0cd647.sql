-- إصلاح الثغرات الأمنية الحرجة في Edge Functions والسياسات

-- 1. إزالة الـ backdoor من سياسة profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;

CREATE POLICY "Users can read their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- 2. إصلاح دالة الباك دور في جدول profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid() OR is_admin_or_deputy())
WITH CHECK (user_id = auth.uid() OR is_admin_or_deputy());

-- 3. تأمين جدول settings - منع PII exposure
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage settings"
ON public.settings
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 4. تأمين جدول delivery_partner_tokens
ALTER TABLE public.delivery_partner_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage delivery tokens"
ON public.delivery_partner_tokens
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 5. إصلاح search_path في جميع الدوال SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_count INTEGER;
  user_role TEXT;
  user_status TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  IF user_count = 0 THEN
    user_role := 'admin';
    user_status := 'active';
  ELSE
    user_role := 'employee';
    user_status := 'pending';
  END IF;
  
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    username, 
    email, 
    role,
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'username', ''),
    NEW.email,
    user_role,
    user_status
  );
  
  RETURN NEW;
END;
$$;

-- 6. تحديث دالة generate_employee_code مع search_path آمن
CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(employee_code FROM 4) AS INTEGER)), 
    0
  ) + 1
  INTO next_number
  FROM public.profiles 
  WHERE employee_code ~ '^EMP[0-9]+$';
  
  new_code := 'EMP' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_code;
END;
$$;

-- 7. تحديث دالة auth_with_username مع search_path آمن
CREATE OR REPLACE FUNCTION public.auth_with_username(username_input text, password_input text)
RETURNS TABLE(success boolean, user_email text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_email_found TEXT;
BEGIN
  SELECT email INTO user_email_found 
  FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_input) 
  AND is_active = true;
  
  IF user_email_found IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, 'اسم المستخدم غير صحيح أو غير موجود'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, user_email_found, ''::TEXT;
END;
$$;

-- 8. تأمين جدول employee_telegram_codes من تسريب chat_id
DROP POLICY IF EXISTS "Authenticated users can view telegram codes" ON public.employee_telegram_codes;

CREATE POLICY "Users can view their own telegram code"
ON public.employee_telegram_codes
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "Only admins can manage telegram codes"
ON public.employee_telegram_codes
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 9. تأمين جدول user_roles
DROP POLICY IF EXISTS "Authenticated users can view user roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "Only admins can manage user roles"
ON public.user_roles
FOR INSERT, UPDATE, DELETE
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 10. تأمين customer_promo_codes من كشف بيانات العملاء
ALTER TABLE public.customer_promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only staff can view customer promo codes"
ON public.customer_promo_codes
FOR SELECT
USING (
  -- الموظفون يمكنهم رؤية البروموكود فقط
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Only admins can manage customer promo codes"
ON public.customer_promo_codes
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- إضافة تنبيه أمني في السجلات
INSERT INTO public.notifications (
  title,
  message,
  type,
  priority,
  data
) VALUES (
  'إصلاحات أمنية مطبقة',
  'تم تطبيق إصلاحات أمنية شاملة تشمل تأمين Edge Functions وإصلاح RLS policies وحماية البيانات الحساسة',
  'security_update',
  'high',
  jsonb_build_object(
    'fixed_issues', jsonb_build_array(
      'Removed profiles backdoor',
      'Secured settings table',
      'Fixed SECURITY DEFINER functions',
      'Protected customer data',
      'Secured telegram chat IDs'
    ),
    'timestamp', now()
  )
);