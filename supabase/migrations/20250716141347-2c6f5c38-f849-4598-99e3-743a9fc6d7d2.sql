-- إصلاح RLS policies لجدول profiles لتستخدم id بدلاً من user_id
-- هذا مطلوب لجعل النظام متوافق مع النسخة الأصلية

-- حذف الـ policies الموجودة
DROP POLICY IF EXISTS "Anyone can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- إنشاء policies جديدة تستخدم id
CREATE POLICY "Anyone can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);