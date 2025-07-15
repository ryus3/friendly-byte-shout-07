-- إصلاح دالة generate_order_number لحل مشكلة التضارب في أسماء الأعمدة
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
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
$function$