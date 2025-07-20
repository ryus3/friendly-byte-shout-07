-- تعيين رأس المال إلى 10,000,000 (سيقوم الترايغر بتصفير كل شيء وإعادة البناء)
UPDATE public.settings 
SET value = '10000000'::jsonb, updated_at = now()
WHERE key = 'initial_capital';