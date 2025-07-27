-- إزالة جميع إشعارات التنظيف غير المرغوب فيها وتحديث دالة release_stock_item
CREATE OR REPLACE FUNCTION public.release_stock_item(p_product_id uuid, p_variant_id uuid, p_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_reserved_quantity INTEGER;
  new_reserved_quantity INTEGER;
  affected_rows INTEGER;
BEGIN
  -- الحصول على الكمية المحجوزة الحالية
  SELECT reserved_quantity INTO old_reserved_quantity 
  FROM public.inventory 
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  -- إلغاء الحجز من جدول المخزون
  UPDATE public.inventory 
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- الحصول على الكمية المحجوزة الجديدة
  SELECT reserved_quantity INTO new_reserved_quantity 
  FROM public.inventory 
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  -- تنظيف أي حجوزات سالبة (في حالة وجود خطأ)
  UPDATE public.inventory 
  SET reserved_quantity = 0
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
  AND reserved_quantity < 0;
  
  -- بدون إشعارات - التنظيف صامت تماماً
  
  RAISE NOTICE 'تم إلغاء حجز % قطعة للمنتج % المتغير % (من % إلى %)', 
               p_quantity, p_product_id, p_variant_id, 
               COALESCE(old_reserved_quantity, 0), COALESCE(new_reserved_quantity, 0);
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_rows', affected_rows,
    'old_reserved_quantity', COALESCE(old_reserved_quantity, 0),
    'new_reserved_quantity', COALESCE(new_reserved_quantity, 0),
    'quantity_released', p_quantity
  );
END;
$function$;

-- حذف جميع إشعارات التنظيف الموجودة
DELETE FROM public.notifications WHERE type IN ('inventory_cleanup', 'inventory_emergency_cleanup', 'inventory_released');