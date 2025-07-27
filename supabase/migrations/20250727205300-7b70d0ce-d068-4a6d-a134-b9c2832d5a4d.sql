-- دالة لتنظيف المخزون المحجوز العام
CREATE OR REPLACE FUNCTION public.cleanup_reserved_stock()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
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