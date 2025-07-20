-- إزالة جميع triggers المتعلقة بالباركود
DROP TRIGGER IF EXISTS auto_generate_variant_barcode ON public.product_variants;
DROP TRIGGER IF EXISTS auto_generate_product_barcode ON public.products;

-- إنشاء triggers بسيطة للباركود فقط
CREATE OR REPLACE FUNCTION public.simple_generate_barcode()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'AUTO_' || EXTRACT(EPOCH FROM now())::bigint || '_' || floor(random() * 1000)::text;
  END IF;
  RETURN NEW;
END;
$$;

-- إضافة triggers بسيطة
CREATE TRIGGER simple_product_barcode
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.simple_generate_barcode();

CREATE TRIGGER simple_variant_barcode
  BEFORE INSERT ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.simple_generate_barcode();