-- إصلاح سياسة RLS للإشعارات لضمان أن الإشعارات العامة (user_id = NULL) تظهر فقط للمديرين

-- حذف السياسات الحالية
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Everyone can view admin notifications" ON public.notifications;

-- سياسة جديدة للإشعارات العامة (user_id = NULL) - فقط للمديرين
CREATE POLICY "Admins can view general notifications"
ON public.notifications
FOR SELECT
USING (
  user_id IS NULL AND is_admin_or_deputy()
);

-- سياسة للإشعارات الشخصية (user_id محدد) - للمستخدم نفسه والمديرين
CREATE POLICY "Users can view their own notifications"
ON public.notifications  
FOR SELECT
USING (
  (user_id = auth.uid()) OR is_admin_or_deputy()
);

-- سياسة للمديرين لإدارة جميع الإشعارات
CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- سياسة للمستخدمين لتحديث إشعاراتهم الشخصية فقط (مثل تعيين is_read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_null ON public.notifications (user_id) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_not_null ON public.notifications (user_id) WHERE user_id IS NOT NULL;