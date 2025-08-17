-- إكمال الإصلاحات الأمنية - تصحيح نهائي لصيغة SQL

-- تأمين جدول customer_promo_codes
DROP POLICY IF EXISTS "Only staff can view customer promo codes" ON public.customer_promo_codes;
DROP POLICY IF EXISTS "Only admins can manage customer promo codes" ON public.customer_promo_codes;
DROP POLICY IF EXISTS "المستخدمون يديرون البروموكود" ON public.customer_promo_codes;

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

CREATE POLICY "Only admins can insert customer promo codes"
ON public.customer_promo_codes
FOR INSERT
WITH CHECK (is_admin_or_deputy());

CREATE POLICY "Only admins can update customer promo codes"
ON public.customer_promo_codes
FOR UPDATE
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

CREATE POLICY "Only admins can delete customer promo codes"
ON public.customer_promo_codes
FOR DELETE
USING (is_admin_or_deputy());

-- تأمين جدول employee_telegram_codes من تسريب chat_id
DROP POLICY IF EXISTS "المستخدمون يديرون أكواد التليغرام" ON public.employee_telegram_codes;

CREATE POLICY "Users can view their own telegram code"
ON public.employee_telegram_codes
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "Only admins can insert telegram codes"
ON public.employee_telegram_codes
FOR INSERT
WITH CHECK (is_admin_or_deputy());

CREATE POLICY "Only admins can update telegram codes"
ON public.employee_telegram_codes
FOR UPDATE
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

CREATE POLICY "Only admins can delete telegram codes"
ON public.employee_telegram_codes
FOR DELETE
USING (is_admin_or_deputy());