-- إضافة حقل صلاحية إدارة العملاء لجدول الموظفين
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS customer_management_access BOOLEAN DEFAULT false;