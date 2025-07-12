-- إضافة حقل اسم الزبون الافتراضي للملفات الشخصية
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_customer_name TEXT;