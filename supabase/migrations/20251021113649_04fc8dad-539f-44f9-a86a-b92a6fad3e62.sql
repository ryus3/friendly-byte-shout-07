-- إصلاح دالة release_stock_item بإزالة عمود available_quantity
CREATE OR REPLACE FUNCTION public.release_stock_item(
  p_product_id uuid, 
  p_variant_id uuid, 
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- تحديث المخزون بدون available_quantity (لأن هذا العمود غير موجود)
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  RAISE NOTICE 'تم تحرير % من المخزون المحجوز - المنتج % (variant: %)', 
    p_quantity, p_product_id, p_variant_id;
END;
$function$;