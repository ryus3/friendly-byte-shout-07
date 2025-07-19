-- تحديث وظيفة توليد QR Code بدلاً من الباركود
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
  qr_data JSONB;
  qr_id TEXT;
BEGIN
  -- إنشاء معرف فريد للـ QR Code
  qr_id := 'QR_' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
  
  -- بناء بيانات QR Code شاملة
  qr_data := jsonb_build_object(
    'id', qr_id,
    'type', 'product',
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'product_name', p_product_name,
    'color', p_color_name,
    'size', p_size_name,
    'generated_at', EXTRACT(epoch FROM NOW()),
    'version', '2.0'
  );
  
  RETURN qr_data;
END;
$function$;

-- تحديث trigger للمنتجات لتوليد QR Code
CREATE OR REPLACE FUNCTION public.auto_generate_product_qrcode()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  qr_data JSONB;
BEGIN
  -- إذا لم يتم توفير QR code، قم بتوليد واحد
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    qr_data := generate_product_qrcode(NEW.name, 'افتراضي', 'افتراضي', NEW.id);
    NEW.barcode := qr_data->>'id';
  END IF;
  RETURN NEW;
END;
$function$;

-- تحديث trigger للمتغيرات لتوليد QR Code
CREATE OR REPLACE FUNCTION public.auto_generate_variant_qrcode()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  product_name TEXT;
  color_name TEXT;
  size_name TEXT;
  qr_data JSONB;
BEGIN
  -- إذا لم يتم توفير QR code، قم بتوليد واحد
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    -- الحصول على أسماء المنتج واللون والحجم
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

-- إضافة جدول لتخزين بيانات QR Codes التفصيلية
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_id TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  qr_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تمكين RLS على جدول QR codes
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "المستخدمون المصرح لهم يرون QR codes" 
ON public.qr_codes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "المستخدمون المصرح لهم يديرون QR codes" 
ON public.qr_codes FOR ALL 
USING (auth.uid() IS NOT NULL);

-- إنشاء trigger لحفظ بيانات QR في الجدول المخصص
CREATE OR REPLACE FUNCTION public.save_qr_data()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  qr_data JSONB;
BEGIN
  -- إنشاء بيانات QR Code شاملة للمنتج
  IF TG_TABLE_NAME = 'products' THEN
    qr_data := generate_product_qrcode(NEW.name, 'افتراضي', 'افتراضي', NEW.id);
    
    INSERT INTO public.qr_codes (qr_id, product_id, qr_data)
    VALUES (qr_data->>'id', NEW.id, qr_data)
    ON CONFLICT (qr_id) DO UPDATE SET
      qr_data = EXCLUDED.qr_data,
      updated_at = now();
      
  -- إنشاء بيانات QR Code شاملة للمتغير
  ELSIF TG_TABLE_NAME = 'product_variants' THEN
    SELECT 
      p.name,
      COALESCE(c.name, 'افتراضي'),
      COALESCE(s.name, 'افتراضي')
    INTO qr_data
    FROM products p 
    LEFT JOIN colors c ON NEW.color_id = c.id
    LEFT JOIN sizes s ON NEW.size_id = s.id
    WHERE p.id = NEW.product_id;
    
    qr_data := generate_product_qrcode(
      COALESCE((qr_data->>'name'), 'منتج'),
      COALESCE((qr_data->>'color'), 'افتراضي'), 
      COALESCE((qr_data->>'size'), 'افتراضي'),
      NEW.product_id,
      NEW.id
    );
    
    INSERT INTO public.qr_codes (qr_id, product_id, variant_id, qr_data)
    VALUES (qr_data->>'id', NEW.product_id, NEW.id, qr_data)
    ON CONFLICT (qr_id) DO UPDATE SET
      qr_data = EXCLUDED.qr_data,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ربط triggers بالجداول
DROP TRIGGER IF EXISTS save_product_qr_data ON public.products;
CREATE TRIGGER save_product_qr_data
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION save_qr_data();

DROP TRIGGER IF EXISTS save_variant_qr_data ON public.product_variants;  
CREATE TRIGGER save_variant_qr_data
  AFTER INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION save_qr_data();