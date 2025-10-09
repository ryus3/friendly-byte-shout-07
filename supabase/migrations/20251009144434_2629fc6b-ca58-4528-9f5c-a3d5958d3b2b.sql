
-- ========================================
-- إصلاح أمان جدول telegram_pending_selections
-- ========================================
-- المشكلة: السياسات الحالية تسمح بجميع العمليات بدون مصادقة (USING true)
-- الحل: استبدالها بسياسات مقيدة حسب دور المستخدم
-- ========================================

-- 1. حذف السياسات غير الآمنة
DROP POLICY IF EXISTS "Allow all operations on telegram_pending_selections" ON public.telegram_pending_selections;
DROP POLICY IF EXISTS "Service role can manage telegram pending selections" ON public.telegram_pending_selections;

-- 2. إنشاء سياسات آمنة جديدة

-- السماح لـ service_role فقط (edge functions) بإضافة سجلات جديدة
-- هذا يضمن أن فقط Telegram bot يمكنه إنشاء pending selections
CREATE POLICY "Service role can insert pending selections"
ON public.telegram_pending_selections
FOR INSERT
TO service_role
WITH CHECK (true);

-- السماح لـ service_role بإدارة جميع السجلات (للتنظيف والصيانة)
CREATE POLICY "Service role can manage all pending selections"
ON public.telegram_pending_selections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- المديرون يمكنهم عرض جميع pending selections للمراقبة
CREATE POLICY "Admins can view all pending selections"
ON public.telegram_pending_selections
FOR SELECT
TO authenticated
USING (is_admin_or_deputy());

-- المديرون يمكنهم حذف pending selections منتهية الصلاحية
CREATE POLICY "Admins can delete pending selections"
ON public.telegram_pending_selections
FOR DELETE
TO authenticated
USING (is_admin_or_deputy());

-- ملاحظة: لا نسمح للمستخدمين العاديين بأي وصول مباشر
-- فقط service_role (Telegram bot) والمديرون يمكنهم الوصول
-- هذا يمنع التلاعب بالطلبات المعلقة

COMMENT ON TABLE public.telegram_pending_selections IS 
'جدول مؤمن: يخزن اختيارات المستخدمين المعلقة من Telegram bot. 
الوصول محصور على: service_role (bot) والمديرين فقط.
آخر تحديث: 2025';
