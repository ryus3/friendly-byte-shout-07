-- إضافة policy للمدراء لإدارة الموظفين بدلاً من التحديث العادي
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can manage any profile" 
ON public.profiles 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.user_id = auth.uid() 
    AND admin_profile.role IN ('admin', 'deputy')
    AND admin_profile.status = 'active'
  )
);