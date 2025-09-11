-- إضافة دعم تعدد الحسابات لشركات التوصيل (تصحيح)
-- Adding multi-account support for delivery partners (fix)

-- إضافة الأعمدة الجديدة لجدول delivery_partner_tokens
ALTER TABLE public.delivery_partner_tokens
ADD COLUMN IF NOT EXISTS account_username TEXT,
ADD COLUMN IF NOT EXISTS merchant_id TEXT,
ADD COLUMN IF NOT EXISTS account_label TEXT,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- إزالة القيد الفريد القديم إذا كان موجوداً
ALTER TABLE public.delivery_partner_tokens
DROP CONSTRAINT IF EXISTS delivery_partner_tokens_user_id_partner_name_key;

-- حذف القيد إذا كان موجوداً مسبقاً
ALTER TABLE public.delivery_partner_tokens
DROP CONSTRAINT IF EXISTS delivery_partner_tokens_user_id_partner_name_account_unique;

-- إضافة قيد فريد جديد يدعم تعدد الحسابات
ALTER TABLE public.delivery_partner_tokens
ADD CONSTRAINT delivery_partner_tokens_multi_account_unique 
UNIQUE (user_id, partner_name, account_username);

-- حذف الفهرس إذا كان موجوداً
DROP INDEX IF EXISTS delivery_partner_tokens_default_account_idx;

-- إضافة قيد لضمان حساب افتراضي واحد فقط لكل مستخدم ولكل شركة
CREATE UNIQUE INDEX delivery_partner_tokens_default_unique_idx
ON public.delivery_partner_tokens (user_id, partner_name) 
WHERE is_default = true;

-- ترحيل البيانات الموجودة - تعيين الحسابات الحالية كافتراضية
UPDATE public.delivery_partner_tokens 
SET 
  is_default = true,
  account_username = COALESCE(account_username, 'default'),
  last_used_at = COALESCE(last_used_at, created_at)
WHERE account_username IS NULL OR is_default IS NULL;

-- تحديث الـ RLS policies للجدول
DROP POLICY IF EXISTS "Users can manage their own delivery partner tokens" ON public.delivery_partner_tokens;
DROP POLICY IF EXISTS "Users can view their own delivery partner tokens" ON public.delivery_partner_tokens;
DROP POLICY IF EXISTS "Admins can view all delivery partner tokens" ON public.delivery_partner_tokens;

-- إعادة إنشاء سياسات RLS محدثة
CREATE POLICY "Users can manage their own delivery partner tokens" 
ON public.delivery_partner_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all delivery partner tokens" 
ON public.delivery_partner_tokens 
FOR SELECT 
USING (is_admin_or_deputy());