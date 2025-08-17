-- إكمال الإصلاحات الأمنية وإصلاح search_path للدوال

-- تأمين جدول customer_promo_codes
DROP POLICY IF EXISTS "Only staff can view customer promo codes" ON public.customer_promo_codes;
DROP POLICY IF EXISTS "Only admins can manage customer promo codes" ON public.customer_promo_codes;

CREATE POLICY "Only staff can view customer promo codes"
ON public.customer_promo_codes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  )
);

CREATE POLICY "Only admins can manage customer promo codes"
ON public.customer_promo_codes
FOR INSERT, UPDATE, DELETE
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- تأمين جدول employee_telegram_codes من تسريب chat_id
DROP POLICY IF EXISTS "Users can view their own telegram code" ON public.employee_telegram_codes;
DROP POLICY IF EXISTS "Only admins can manage telegram codes" ON public.employee_telegram_codes;

CREATE POLICY "Users can view their own telegram code"
ON public.employee_telegram_codes
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "Only admins can manage telegram codes"
ON public.employee_telegram_codes
FOR INSERT, UPDATE, DELETE
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- تأمين جدول user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "Only admins can manage user roles"
ON public.user_roles
FOR INSERT, UPDATE, DELETE
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());