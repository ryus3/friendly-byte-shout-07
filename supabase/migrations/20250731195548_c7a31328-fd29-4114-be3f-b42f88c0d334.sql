-- إصلاح التنبيهات الأمنية: إضافة SET search_path = 'public' للدوال الناقصة

-- 1. إصلاح دالة auto_generate_variant_qrcode
CREATE OR REPLACE FUNCTION public.auto_generate_variant_qrcode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- 2. إصلاح دالة simple_generate_barcode
CREATE OR REPLACE FUNCTION public.simple_generate_barcode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'AUTO_' || EXTRACT(EPOCH FROM now())::bigint || '_' || floor(random() * 1000)::text;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. إصلاح دالة set_order_number
CREATE OR REPLACE FUNCTION public.set_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. إصلاح دالة generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  result_order_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders o
  WHERE o.order_number ~ '^ORD[0-9]+$';
  
  result_order_number := 'ORD' || LPAD(next_number::TEXT, 6, '0');
  RETURN result_order_number;
END;
$function$;

-- 5. إصلاح دالة auto_assign_employee_code
CREATE OR REPLACE FUNCTION public.auto_assign_employee_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := generate_employee_code();
  END IF;
  RETURN NEW;
END;
$function$;