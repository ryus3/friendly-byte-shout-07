-- إصلاح الثغرات الأمنية بحذف السياسات المكررة أولاً

-- حذف السياسات الموجودة وإعادة إنشائها
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- إنشاء السياسة الجديدة بدون backdoor
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid() OR is_admin_or_deputy())
WITH CHECK (user_id = auth.uid() OR is_admin_or_deputy());

-- تأمين جدول settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can manage settings" ON public.settings;
CREATE POLICY "Only admins can manage settings"
ON public.settings
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- تأمين جدول delivery_partner_tokens
ALTER TABLE public.delivery_partner_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can manage delivery tokens" ON public.delivery_partner_tokens;
CREATE POLICY "Only admins can manage delivery tokens"
ON public.delivery_partner_tokens
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());