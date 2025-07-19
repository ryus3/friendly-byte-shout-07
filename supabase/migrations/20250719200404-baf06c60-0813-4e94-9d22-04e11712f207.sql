-- إنشاء إعداد رأس المال الصحيح وتنظيف البيانات
INSERT INTO settings (key, value, description)
VALUES ('app_settings', '{"capital": 20000000}', 'إعدادات التطبيق الأساسية')
ON CONFLICT (key) DO UPDATE SET
value = EXCLUDED.value,
description = EXCLUDED.description;

-- تنظيف البيانات القديمة غير الصحيحة
UPDATE settings 
SET value = jsonb_strip_nulls(value - 'capital'::text)
WHERE key IN ('app_name', 'currency') 
AND value ? 'capital';

-- إزالة أي قيم capital منفصلة من الإعدادات الأخرى
UPDATE settings 
SET value = jsonb_strip_nulls(value - 'capital'::text)
WHERE key != 'app_settings' 
AND jsonb_typeof(value) = 'object'
AND value ? 'capital';