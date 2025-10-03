-- إضافة إعداد شركة التوصيل الافتراضية للبوت (مع jsonb الصحيح)

INSERT INTO public.settings (key, value, description)
VALUES (
  'telegram_bot_delivery_partner',
  '"alwaseet"'::jsonb,
  'شركة التوصيل الافتراضية المستخدمة في بوت تليغرام - يمكن تغييرها إلى شركات أخرى مستقبلاً'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();