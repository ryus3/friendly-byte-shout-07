-- إصلاح مشكلة عرض المخزون المحجوز
-- أولاً نحديث المخزون المحجوز للطلب قيد التوصيل
UPDATE inventory 
SET reserved_quantity = (
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = inventory.variant_id
  AND o.status IN ('pending', 'processing', 'delivery')
  AND o.isArchived = false
)
WHERE variant_id IN (
  SELECT DISTINCT oi.variant_id
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.status IN ('pending', 'processing', 'delivery')
  AND o.isArchived = false
);

-- تحديث دالة حجز المخزون لضمان العمل الصحيح
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(
  p_product_id uuid, 
  p_variant_id uuid, 
  p_quantity integer
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_stock INTEGER;
  current_reserved INTEGER;
  available_stock INTEGER;
BEGIN
  -- الحصول على المخزون الحالي والمحجوز
  SELECT quantity, COALESCE(reserved_quantity, 0) 
  INTO current_stock, current_reserved
  FROM public.inventory 
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  IF current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المنتج غير موجود في المخزون');
  END IF;
  
  available_stock := current_stock - current_reserved;
  
  -- التحقق من توفر المخزون
  IF available_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'المخزون المتاح غير كافي. المتاح: ' || available_stock || ', المطلوب: ' || p_quantity
    );
  END IF;
  
  -- حجز المخزون - تحديث محسن
  UPDATE public.inventory 
  SET 
    reserved_quantity = COALESCE(reserved_quantity, 0) + p_quantity,
    updated_at = now()
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  -- تسجيل حجز المخزون في السجل
  RAISE NOTICE 'تم حجز % قطعة للمنتج % المتغير %. المخزون المحجوز الجديد: %', 
               p_quantity, p_product_id, p_variant_id, current_reserved + p_quantity;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حجز ' || p_quantity || ' قطعة بنجاح',
    'reserved_quantity', p_quantity,
    'new_reserved_total', current_reserved + p_quantity,
    'remaining_available', available_stock - p_quantity
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;