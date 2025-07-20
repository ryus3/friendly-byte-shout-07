-- تصفير جميع حركات النقد والأرصدة
DELETE FROM public.cash_movements;

-- إعادة تعيين أرصدة جميع المصادر للصفر
UPDATE public.cash_sources 
SET current_balance = 0, 
    updated_at = now()
WHERE is_active = true;

-- تحديث القاصة الرئيسية لتعكس رأس المال + صافي الأرباح
-- سيتم حساب هذا برمجياً في التطبيق