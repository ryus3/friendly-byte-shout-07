-- اختبار صحيح: تعديل رأس المال لـ 12 مليون
UPDATE public.settings 
SET value = '12000000'::jsonb, updated_at = now() 
WHERE key = 'initial_capital';

-- فحص النتيجة
SELECT 
  'بعد التعديل' as status,
  (SELECT value FROM public.settings WHERE key = 'initial_capital') as capital_setting,
  (SELECT initial_balance FROM public.cash_sources WHERE name = 'القاصة الرئيسية') as cash_initial,
  (SELECT current_balance FROM public.cash_sources WHERE name = 'القاصة الرئيسية') as cash_current;

-- فحص آخر حركة نقدية
SELECT 
  description,
  movement_type, 
  amount,
  balance_before,
  balance_after,
  created_at
FROM public.cash_movements cm
JOIN public.cash_sources cs ON cm.cash_source_id = cs.id
WHERE cs.name = 'القاصة الرئيسية'
ORDER BY created_at DESC
LIMIT 1;