-- تحديث إعدادات إشعارات المخزون لتعكس التكرار الصحيح
UPDATE settings 
SET value = jsonb_build_object(
  'hours', 168  -- أسبوع كامل بدلاً من 24 ساعة
)
WHERE key = 'stock_notification_frequency';

-- إضافة إعداد لتوفير البيانات
INSERT INTO settings (key, value, description) 
VALUES (
  'data_optimization',
  jsonb_build_object(
    'cache_duration_minutes', 30,
    'compress_responses', true,
    'lazy_load_images', true,
    'minimal_notifications', true
  ),
  'إعدادات تحسين استخدام البيانات'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;