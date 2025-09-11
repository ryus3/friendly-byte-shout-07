-- إضافة عمود لاسم المستخدم المطبع ومنع التكرار
ALTER TABLE public.delivery_partner_tokens 
ADD COLUMN IF NOT EXISTS normalized_username text GENERATED ALWAYS AS (lower(trim(account_username))) STORED;

-- إنشاء فهرس فريد لمنع تكرار الحسابات
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_partner_tokens_unique_user_partner_username
ON public.delivery_partner_tokens (user_id, partner_name, normalized_username);