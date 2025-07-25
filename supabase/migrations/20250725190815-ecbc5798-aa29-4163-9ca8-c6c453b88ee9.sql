-- إنشاء function لإنشاء عملاء تلقائياً من الطلبات
CREATE OR REPLACE FUNCTION public.auto_create_customer_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  existing_customer_id UUID;
BEGIN
  -- البحث عن عميل موجود بنفس الاسم والهاتف
  IF NEW.customer_name IS NOT NULL AND NEW.customer_phone IS NOT NULL THEN
    SELECT id INTO existing_customer_id 
    FROM public.customers 
    WHERE name = NEW.customer_name 
    AND phone = NEW.customer_phone
    LIMIT 1;
    
    -- إذا لم يوجد عميل، أنشئ واحد جديد
    IF existing_customer_id IS NULL THEN
      INSERT INTO public.customers (
        name,
        phone,
        city,
        province,
        address,
        created_by
      ) VALUES (
        NEW.customer_name,
        NEW.customer_phone,
        NEW.customer_city,
        NEW.customer_province,
        NEW.customer_address,
        NEW.created_by
      ) RETURNING id INTO existing_customer_id;
      
      RAISE NOTICE 'تم إنشاء عميل جديد: % مع المعرف %', NEW.customer_name, existing_customer_id;
    END IF;
    
    -- ربط الطلب بالعميل
    NEW.customer_id := existing_customer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء trigger لتطبيق الfunction تلقائياً
DROP TRIGGER IF EXISTS auto_create_customer_trigger ON public.orders;
CREATE TRIGGER auto_create_customer_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_customer_from_order();