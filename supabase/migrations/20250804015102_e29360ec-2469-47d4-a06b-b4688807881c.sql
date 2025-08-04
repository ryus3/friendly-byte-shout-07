-- إصلاح مشكلة الأمان - تحديث search_path للدوال الموجودة
CREATE OR REPLACE FUNCTION public.auto_generate_variant_qrcode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.generate_product_qrcode(
  p_product_name text,
  p_color_name text,
  p_size_name text,
  p_product_id uuid,
  p_variant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  qr_id text;
  qr_data jsonb;
BEGIN
  -- إنشاء معرف فريد للباركود
  qr_id := 'QR_' || EXTRACT(EPOCH FROM now())::bigint || '_' || floor(random() * 1000)::text;
  
  -- بناء بيانات الباركود
  qr_data := jsonb_build_object(
    'id', qr_id,
    'product_name', p_product_name,
    'color', p_color_name,
    'size', p_size_name,
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'created_at', now()
  );
  
  -- حفظ الباركود في الجدول
  INSERT INTO qr_codes (qr_id, product_id, variant_id, qr_data)
  VALUES (qr_id, p_product_id, p_variant_id, qr_data)
  ON CONFLICT (qr_id) DO NOTHING;
  
  RETURN qr_data;
END;
$function$;