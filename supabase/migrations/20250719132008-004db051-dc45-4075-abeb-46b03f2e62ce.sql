-- إصلاح دالة save_qr_data وتوليد QR codes للمنتجات الموجودة
DROP FUNCTION IF EXISTS public.save_qr_data() CASCADE;

-- إنشاء دالة محسنة لحفظ بيانات QR
CREATE OR REPLACE FUNCTION public.save_qr_data()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  qr_data JSONB;
  product_name TEXT;
  color_name TEXT;
  size_name TEXT;
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
    
    INSERT INTO public.qr_codes (qr_id, product_id, variant_id, qr_data)
    VALUES (qr_data->>'id', NEW.product_id, NEW.id, qr_data)
    ON CONFLICT (qr_id) DO UPDATE SET
      qr_data = EXCLUDED.qr_data,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إعادة إنشاء triggers
DROP TRIGGER IF EXISTS save_product_qr_data ON public.products;
CREATE TRIGGER save_product_qr_data
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION save_qr_data();

DROP TRIGGER IF EXISTS save_variant_qr_data ON public.product_variants;  
CREATE TRIGGER save_variant_qr_data
  AFTER INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION save_qr_data();

-- الآن توليد QR codes للمنتجات الموجودة
DO $$
DECLARE
    product_record RECORD;
    variant_record RECORD;
    qr_data JSONB;
BEGIN
    -- تحديث المنتجات الموجودة لتوليد QR codes
    FOR product_record IN 
        SELECT * FROM public.products WHERE is_active = true
    LOOP
        -- توليد QR code للمنتج الأساسي
        qr_data := generate_product_qrcode(
            product_record.name, 
            'افتراضي', 
            'افتراضي', 
            product_record.id
        );
        
        -- تحديث المنتج بـ QR code الجديد
        UPDATE public.products 
        SET barcode = qr_data->>'id',
            updated_at = now()
        WHERE id = product_record.id;
        
        -- حفظ بيانات QR في الجدول المخصص
        INSERT INTO public.qr_codes (qr_id, product_id, qr_data)
        VALUES (qr_data->>'id', product_record.id, qr_data)
        ON CONFLICT (qr_id) DO UPDATE SET
            qr_data = EXCLUDED.qr_data,
            updated_at = now();
    END LOOP;
    
    -- توليد QR codes للمتغيرات الموجودة
    FOR variant_record IN 
        SELECT 
            pv.*,
            p.name as product_name,
            c.name as color_name,
            s.name as size_name
        FROM public.product_variants pv
        LEFT JOIN public.products p ON pv.product_id = p.id
        LEFT JOIN public.colors c ON pv.color_id = c.id
        LEFT JOIN public.sizes s ON pv.size_id = s.id
        WHERE pv.is_active = true
    LOOP
        -- توليد QR code للمتغير
        qr_data := generate_product_qrcode(
            COALESCE(variant_record.product_name, 'منتج'),
            COALESCE(variant_record.color_name, 'افتراضي'),
            COALESCE(variant_record.size_name, 'افتراضي'),
            variant_record.product_id,
            variant_record.id
        );
        
        -- تحديث المتغير بـ QR code الجديد
        UPDATE public.product_variants 
        SET barcode = qr_data->>'id',
            updated_at = now()
        WHERE id = variant_record.id;
        
        -- حفظ بيانات QR في الجدول المخصص
        INSERT INTO public.qr_codes (qr_id, product_id, variant_id, qr_data)
        VALUES (qr_data->>'id', variant_record.product_id, variant_record.id, qr_data)
        ON CONFLICT (qr_id) DO UPDATE SET
            qr_data = EXCLUDED.qr_data,
            updated_at = now();
    END LOOP;
    
    RAISE NOTICE 'تم توليد QR codes لجميع المنتجات والمتغيرات الموجودة';
END $$;