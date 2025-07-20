-- إزالة جميع triggers الموجودة المتعلقة بـ QR و barcode
DROP TRIGGER IF EXISTS save_qr_data ON public.products;
DROP TRIGGER IF EXISTS save_qr_data ON public.product_variants;

-- حذف functions التي تستدعي generate_product_qrcode
DROP FUNCTION IF EXISTS public.auto_generate_variant_qrcode();
DROP FUNCTION IF EXISTS public.auto_generate_product_qrcode();
DROP FUNCTION IF EXISTS public.save_qr_data();

-- البحث عن triggers أخرى وحذفها
SELECT 'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON ' || event_object_schema || '.' || event_object_table || ';'
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND action_statement LIKE '%generate_product%';