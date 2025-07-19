-- تحديث دالة توليد QR Code لتعمل بشكل صحيح
CREATE OR REPLACE FUNCTION public.generate_product_qrcode(
  p_product_name text,
  p_color_name text DEFAULT 'افتراضي'::text,
  p_size_name text DEFAULT 'افتراضي'::text,
  p_product_id uuid DEFAULT NULL::uuid,
  p_variant_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  qr_id text;
  qr_data jsonb;
BEGIN
  -- توليد معرف فريد للـ QR Code
  qr_id := 'QR_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  
  -- إنشاء بيانات QR Code شاملة
  qr_data := jsonb_build_object(
    'id', qr_id,
    'type', 'product',
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'product_name', p_product_name,
    'color', p_color_name,
    'size', p_size_name,
    'generated_at', extract(epoch from now()) * 1000,
    'version', '2.0'
  );
  
  RETURN qr_data;
END;
$function$;

-- تحديث triggers للتأكد من عملهم بشكل صحيح
DROP TRIGGER IF EXISTS auto_generate_product_qrcode ON public.products;
DROP TRIGGER IF EXISTS auto_generate_variant_qrcode ON public.product_variants;

-- تحديث دالة auto_generate_product_qrcode للمنتجات
CREATE OR REPLACE FUNCTION public.auto_generate_product_qrcode()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  qr_data jsonb;
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    qr_data := generate_product_qrcode(NEW.name, 'افتراضي', 'افتراضي', NEW.id);
    NEW.barcode := qr_data->>'id';
  END IF;
  RETURN NEW;
END;
$function$;

-- تحديث دالة auto_generate_variant_qrcode للمتغيرات
CREATE OR REPLACE FUNCTION public.auto_generate_variant_qrcode()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  qr_data jsonb;
  product_name text;
  color_name text;
  size_name text;
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    -- الحصول على اسم المنتج واللون والحجم
    SELECT p.name INTO product_name FROM products p WHERE p.id = NEW.product_id;
    SELECT c.name INTO color_name FROM colors c WHERE c.id = NEW.color_id;
    SELECT s.name INTO size_name FROM sizes s WHERE s.id = NEW.size_id;
    
    qr_data := generate_product_qrcode(
      COALESCE(product_name, 'منتج'),
      COALESCE(color_name, 'افتراضي'), 
      COALESCE(size_name, 'افتراضي'),
      NEW.product_id,
      NEW.id
    );
    NEW.barcode := qr_data->>'id';
  END IF;
  RETURN NEW;
END;
$function$;

-- إعادة إنشاء triggers
CREATE TRIGGER auto_generate_product_qrcode
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION auto_generate_product_qrcode();

CREATE TRIGGER auto_generate_variant_qrcode
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION auto_generate_variant_qrcode();