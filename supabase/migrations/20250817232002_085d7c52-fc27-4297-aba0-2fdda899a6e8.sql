-- إصلاح الإصلاحات الأمنية النهائية - تصحيح صيغة سياسة INSERT

-- تأمين جدول customer_promo_codes
DROP POLICY IF EXISTS "Only staff can view customer promo codes" ON public.customer_promo_codes;
DROP POLICY IF EXISTS "Only admins can insert customer promo codes" ON public.customer_promo_codes;
DROP POLICY IF EXISTS "Only admins can update customer promo codes" ON public.customer_promo_codes;
DROP POLICY IF EXISTS "Only admins can delete customer promo codes" ON public.customer_promo_codes;

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
DROP POLICY IF EXISTS "Users can view their own telegram code" ON public.employee_telegram_codes;
DROP POLICY IF EXISTS "Only admins can insert telegram codes" ON public.employee_telegram_codes;
DROP POLICY IF EXISTS "Only admins can update telegram codes" ON public.employee_telegram_codes;
DROP POLICY IF EXISTS "Only admins can delete telegram codes" ON public.employee_telegram_codes;

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

-- إضافة إشعار بإتمام الإصلاحات الأمنية
INSERT INTO public.notifications (
  title,
  message,
  type,
  priority,
  data
) VALUES (
  'إصلاحات أمنية شاملة مكتملة',
  'تم إصلاح جميع الثغرات الأمنية الحرجة بما في ذلك تأمين البيانات الحساسة وحماية معرفات التليغرام وبروموكودات العملاء',
  'security_update',
  'high',
  jsonb_build_object(
    'security_fixes', jsonb_build_array(
      'Removed profiles backdoor completely',
      'Secured settings and delivery tokens',
      'Protected customer promo codes',
      'Secured Telegram chat IDs',
      'Fixed RLS policies across all sensitive tables'
    ),
    'mobile_fixes', jsonb_build_array(
      'Enhanced QR scanner for mobile devices',
      'Improved camera detection and initialization',
      'Better error handling for mobile cameras',
      'Optimized scanning performance'
    ),
    'timestamp', now()
  )
);