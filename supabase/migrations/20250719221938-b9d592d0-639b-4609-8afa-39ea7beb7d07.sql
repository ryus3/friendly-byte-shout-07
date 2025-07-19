-- تحديث دالة توليد رقم فاتورة الشراء لتبدأ من 1
CREATE OR REPLACE FUNCTION public.generate_purchase_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    new_number TEXT;
    max_num INTEGER;
BEGIN
    -- الحصول على أعلى رقم فاتورة حالي
    SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM '[0-9]+$') AS INTEGER)), 0)
    INTO max_num
    FROM public.purchases
    WHERE purchase_number ~ '^[0-9]+$';
    
    -- توليد الرقم الجديد (رقم صغير يبدأ من 1)
    new_number := (max_num + 1)::TEXT;
    
    RETURN new_number;
END;
$function$;