-- حذف triggers الموجودة أولاً ثم functions
DROP TRIGGER IF EXISTS save_product_qr_data ON public.products;
DROP TRIGGER IF EXISTS save_variant_qr_data ON public.product_variants;

-- الآن يمكن حذف function
DROP FUNCTION IF EXISTS public.save_qr_data() CASCADE;