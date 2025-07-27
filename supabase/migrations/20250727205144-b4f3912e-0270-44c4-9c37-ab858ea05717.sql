-- دالة محسنة لإلغاء حجز المخزون مع التنظيف الفوري
CREATE OR REPLACE FUNCTION public.release_stock_item(p_product_id uuid, p_variant_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- إلغاء الحجز من جدول المخزون
  UPDATE public.inventory 
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  -- تنظيف أي حجوزات سالبة (في حالة وجود خطأ)
  UPDATE public.inventory 
  SET reserved_quantity = 0
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
  AND reserved_quantity < 0;
  
  RAISE NOTICE 'تم إلغاء حجز % قطعة للمنتج % المتغير %', p_quantity, p_product_id, p_variant_id;
END;
$function$;