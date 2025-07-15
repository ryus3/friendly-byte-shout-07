-- إضافة إعدادات افتراضية لرسوم التوصيل إذا لم تكن موجودة
INSERT INTO public.settings (key, value, description)
VALUES ('delivery_fee', '5000', 'رسوم التوصيل الافتراضية بالدينار العراقي')
ON CONFLICT (key) DO NOTHING;