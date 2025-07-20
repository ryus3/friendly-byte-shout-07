-- اختبار تعديل رأس المال لـ 12 مليون
UPDATE public.settings 
SET value = 12000000, updated_at = now() 
WHERE key = 'initial_capital';

-- فحص النتيجة مباشرة
SELECT 
  'بعد التعديل مباشرة' as status,
  (SELECT value FROM public.settings WHERE key = 'initial_capital') as capital_setting,
  (SELECT initial_balance FROM public.cash_sources WHERE name = 'القاصة الرئيسية') as cash_initial,
  (SELECT current_balance FROM public.cash_sources WHERE name = 'القاصة الرئيسية') as cash_current;