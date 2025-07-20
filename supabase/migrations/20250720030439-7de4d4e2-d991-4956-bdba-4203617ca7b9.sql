-- إزالة triggers القديمة التي تسبب مشاكل
DROP TRIGGER IF EXISTS auto_generate_variant_qrcode ON public.product_variants;
DROP TRIGGER IF EXISTS auto_generate_product_qrcode ON public.products;
DROP TRIGGER IF EXISTS save_qr_data_trigger ON public.products;
DROP TRIGGER IF EXISTS save_qr_data_trigger ON public.product_variants;