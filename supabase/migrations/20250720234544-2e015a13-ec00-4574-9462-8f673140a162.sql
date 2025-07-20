-- إصلاح تعارض رأس المال وتوحيد المصدر
-- حذف رأس المال المكرر من app_settings
UPDATE public.settings 
SET value = value - 'capital'::text
WHERE key = 'app_settings' 
AND value ? 'capital';

-- التأكد من وجود initial_capital الصحيح
INSERT INTO public.settings (key, value, description)
VALUES ('initial_capital', '4000000', 'رأس المال الأولي للشركة')
ON CONFLICT (key) DO NOTHING;