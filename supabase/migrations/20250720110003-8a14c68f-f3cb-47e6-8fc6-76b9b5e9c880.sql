-- إصلاح الخطأ وإعادة النظام لحالته الصحيحة

-- 1. حذف الدالة والـ trigger الجديد الذي أضفته خطأً
DROP TRIGGER IF EXISTS trigger_auto_calculate_profit ON public.orders;
DROP FUNCTION IF EXISTS public.auto_calculate_profit_on_receipt();

-- 2. تنظيف القاصة وإعادة ضبطها للوضع الصحيح
DELETE FROM public.cash_movements 
WHERE reference_type = 'realized_profit' 
AND cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية');

-- 3. إعادة ضبط رصيد القاصة الرئيسية
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 4. حذف جدول الأرباح المضاعف
DELETE FROM public.profits;

-- 5. التحقق من الـ trigger الأصلي الموجود
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND event_object_table = 'orders';