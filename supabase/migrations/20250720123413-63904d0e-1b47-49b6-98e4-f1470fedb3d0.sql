-- اختبار صحيح: تعديل رأس المال لـ 12 مليون
UPDATE public.settings 
SET value = '12000000'::jsonb, updated_at = now() 
WHERE key = 'initial_capital';