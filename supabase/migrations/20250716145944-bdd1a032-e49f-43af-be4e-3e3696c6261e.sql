-- إضافة policy للمدراء لتحديث ملفات المستخدمين الآخرين
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'deputy')
  )
);