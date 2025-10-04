-- ====================================
-- Migration: إصلاح وتحسين telegram_pending_selections
-- ====================================

-- 1. تعديل expires_at إلى 10 دقائق بدلاً من 5 (حالياً لا يوجد default)
ALTER TABLE public.telegram_pending_selections 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 minutes');

-- 2. إضافة عمود action إذا لم يكن موجود
ALTER TABLE public.telegram_pending_selections 
ADD COLUMN IF NOT EXISTS action TEXT;

-- 3. إضافة عمود context إذا لم يكن موجود
ALTER TABLE public.telegram_pending_selections 
ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;

-- 4. إضافة عمود id إذا لم يكن موجود
ALTER TABLE public.telegram_pending_selections 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- 5. إضافة فهرس لتحسين الأداء عند البحث عن الحالات المعلقة
CREATE INDEX IF NOT EXISTS idx_telegram_pending_chat_action 
ON public.telegram_pending_selections(chat_id, action, expires_at);

-- 6. إضافة فهرس لتحسين الأداء عند حذف الحالات المنتهية
CREATE INDEX IF NOT EXISTS idx_telegram_pending_expires 
ON public.telegram_pending_selections(expires_at);

-- 7. إضافة فهرس على selection_type
CREATE INDEX IF NOT EXISTS idx_telegram_pending_selection_type 
ON public.telegram_pending_selections(chat_id, selection_type, expires_at);

COMMENT ON COLUMN public.telegram_pending_selections.expires_at IS 'وقت انتهاء صلاحية الاختيار (10 دقائق افتراضياً)';
COMMENT ON COLUMN public.telegram_pending_selections.action IS 'نوع الإجراء المعلق (region_clarification, inv_product, etc.)';
COMMENT ON COLUMN public.telegram_pending_selections.context IS 'سياق الطلب المحفوظ (employee_code, original_text, city_id, region_id, etc.)';
