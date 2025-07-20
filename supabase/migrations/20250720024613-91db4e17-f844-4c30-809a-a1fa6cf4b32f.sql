-- تحديث رصيد القاصة الرئيسية ليعكس رأس المال + الأرباح
UPDATE public.cash_sources 
SET current_balance = (
    SELECT 
        COALESCE((SELECT value::numeric FROM public.settings WHERE key = 'initial_capital'), 0) +
        COALESCE((SELECT SUM(employee_profit) FROM public.profits WHERE status = 'settled'), 0)
)
WHERE name = 'القاصة الرئيسية';

-- تحديث مصادر النقد الأخرى إذا لم تكن محدثة
UPDATE public.cash_sources 
SET current_balance = initial_balance 
WHERE current_balance = 0 AND initial_balance > 0;