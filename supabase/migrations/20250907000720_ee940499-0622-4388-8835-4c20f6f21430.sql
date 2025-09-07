-- إصلاح مشاكل الأمان: إضافة RLS للجدول الجديد مع التصحيح
DROP POLICY IF EXISTS "Admins can view background sync logs" ON public.background_sync_logs;
DROP POLICY IF EXISTS "System can insert background sync logs" ON public.background_sync_logs;

-- إنشاء policy للقراءة (للمدراء فقط) - تصحيح
CREATE POLICY "Admins can view background sync logs" 
ON public.background_sync_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
    AND ur.is_active = true
  )
);

-- إنشاء policy للإدراج (للنظام فقط)
CREATE POLICY "System can insert background sync logs" 
ON public.background_sync_logs 
FOR INSERT 
WITH CHECK (true);

-- إنشاء policy للحذف (للمدراء فقط)
CREATE POLICY "Admins can delete background sync logs" 
ON public.background_sync_logs 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
    AND ur.is_active = true
  )
);