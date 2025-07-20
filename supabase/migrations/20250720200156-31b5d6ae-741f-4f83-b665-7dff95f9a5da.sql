-- إصلاح رصيد القاصة الرئيسية: إزالة التكرار

-- 1. حذف الحركة المكررة لرأس المال
DELETE FROM public.cash_movements 
WHERE cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية')
AND reference_type = 'initial_capital'
AND description = 'رأس المال المُحدّث';

-- 2. إعادة حساب الرصيد الصحيح للقاصة الرئيسية
SELECT public.recalculate_main_cash_balance();