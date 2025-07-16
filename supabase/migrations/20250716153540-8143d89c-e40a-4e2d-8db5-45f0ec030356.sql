-- إصلاح مشكلة infinite recursion في RLS policies
-- حذف الـ policy المشكلة وإنشاء حل آمن

-- حذف الـ policy المسببة للمشكلة
DROP POLICY IF EXISTS "Admins can manage any profile" ON public.profiles;

-- إنشاء دالة آمنة للتحقق من دور المستخدم
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy()
RETURNS BOOLEAN AS $$
BEGIN
  -- التحقق مباشرة من auth.uid() مع تجنب الاستعلام الدوري
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'admin' OR
      auth.users.raw_user_meta_data->>'role' = 'deputy' OR
      auth.users.email IN ('ryusbrand@gmail.com') -- المدير الأساسي
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- إنشاء policy آمنة للمدراء
CREATE POLICY "Safe admin access to profiles" 
ON public.profiles 
FOR ALL
USING (
  -- السماح للمستخدم بالوصول لملفه الشخصي
  auth.uid() = user_id 
  OR 
  -- السماح للمدير الأساسي بالوصول لكل شيء
  auth.uid()::text = '91484496-b887-44f7-9e5d-be9db5567604'
  OR
  -- أو إذا كان المستخدم مدير/نائب
  public.is_admin_or_deputy()
)
WITH CHECK (
  -- نفس الشروط للتحديث
  auth.uid() = user_id 
  OR 
  auth.uid()::text = '91484496-b887-44f7-9e5d-be9db5567604'
  OR
  public.is_admin_or_deputy()
);