-- إصلاح نهائي لـ RLS policies لجدول profiles
-- المشكلة: auth.uid() يُرجع user_id وليس id
-- لذلك يجب أن تستخدم policies user_id في المقارنة

-- حذف الـ policies الخاطئة
DROP POLICY IF EXISTS "Anyone can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- إنشاء policies صحيحة تستخدم user_id
CREATE POLICY "Anyone can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);