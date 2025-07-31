-- إصلاح وظائف قاعدة البيانات لتحسين الأمان
-- إضافة SET search_path = 'public' للوظائف المطلوبة

CREATE OR REPLACE FUNCTION public.generate_employee_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- الحصول على أعلى رقم موجود
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(employee_code FROM 4) AS INTEGER)), 
    0
  ) + 1
  INTO next_number
  FROM profiles 
  WHERE employee_code ~ '^EMP[0-9]+$';
  
  -- إنشاء المعرف الجديد
  new_code := 'EMP' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_assign_employee_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := generate_employee_code();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_points_expiry_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- تحديث تاريخ انتهاء الصلاحية عند تحديث النقاط
  IF NEW.total_points != OLD.total_points THEN
    NEW.points_expiry_date := now() + INTERVAL '3 months';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  DELETE FROM system_backups 
  WHERE created_at < now() - interval '30 days'
  AND is_auto_backup = true;
  
  DELETE FROM system_backups 
  WHERE id NOT IN (
    SELECT id FROM system_backups 
    WHERE is_auto_backup = false
    ORDER BY created_at DESC 
    LIMIT 10
  ) AND is_auto_backup = false;
  
  RAISE NOTICE 'تم تنظيف النسخ الاحتياطية القديمة';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_reserved_stock()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  -- تنظيف المخزون المحجوز للطلبات المحذوفة أو المكتملة
  UPDATE public.inventory 
  SET 
    reserved_quantity = 0,
    updated_at = now()
  WHERE reserved_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_id = inventory.product_id
    AND (oi.variant_id = inventory.variant_id OR (oi.variant_id IS NULL AND inventory.variant_id IS NULL))
    AND o.status = 'pending'
  );
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RAISE NOTICE 'تم تنظيف % عنصر من المخزون المحجوز', cleaned_count;
  RETURN cleaned_count;
END;
$function$;