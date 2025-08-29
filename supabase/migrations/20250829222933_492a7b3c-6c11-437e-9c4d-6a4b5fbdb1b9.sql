-- إضافة العمود المفقود last_updated_by لجدول products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES auth.users(id);

-- تحديث القيم الفارغة بمعرف المستخدم الحالي أو المدير
UPDATE public.products 
SET last_updated_by = COALESCE(created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
WHERE last_updated_by IS NULL;