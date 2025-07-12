-- إضافة عمود expires_at لجدول delivery_partner_tokens
ALTER TABLE public.delivery_partner_tokens 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days');

-- إضافة عمود user_id لربط التوكن بالمستخدم
ALTER TABLE public.delivery_partner_tokens 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- إضافة عمود partner_data لتخزين بيانات الشريك
ALTER TABLE public.delivery_partner_tokens 
ADD COLUMN partner_data JSONB DEFAULT '{}'::jsonb;