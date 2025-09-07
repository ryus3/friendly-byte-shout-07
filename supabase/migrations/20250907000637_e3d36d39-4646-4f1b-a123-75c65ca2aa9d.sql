-- إصلاح مشاكل الأمان: إضافة RLS للجدول الجديد
ALTER TABLE public.background_sync_logs ENABLE ROW LEVEL SECURITY;

-- إنشاء policy للقراءة (للمدراء فقط)
CREATE POLICY "Admins can view background sync logs" 
ON public.background_sync_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- إنشاء policy للإدراج (للنظام فقط)
CREATE POLICY "System can insert background sync logs" 
ON public.background_sync_logs 
FOR INSERT 
WITH CHECK (true);