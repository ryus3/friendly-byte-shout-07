-- إصلاح الثغرات الأمنية الحرجة - الجزء الأول

-- 1. إزالة الـ backdoor من سياسة profiles
DROP POLICY IF EXISTS "Safe admin access to profiles" ON public.profiles;

CREATE POLICY "Users can read their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid() OR is_admin_or_deputy())
WITH CHECK (user_id = auth.uid() OR is_admin_or_deputy());

-- 2. تأمين جدول settings - منع PII exposure
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage settings"
ON public.settings
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 3. تأمين جدول delivery_partner_tokens
ALTER TABLE public.delivery_partner_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage delivery tokens"
ON public.delivery_partner_tokens
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());