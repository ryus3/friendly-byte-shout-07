-- تحسين دالة تحرير المخزون مع إشعارات وتتبع أفضل
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
  
  -- إضافة إشعار للمديرين عن تحرير المخزون
  INSERT INTO public.notifications (
    title,
    message,
    type,
    data,
    user_id
  ) VALUES (
    'تحرير مخزون',
    'تم تحرير ' || p_quantity || ' قطعة من المخزون المحجوز',
    'inventory_released',
    jsonb_build_object(
      'product_id', p_product_id, 
      'variant_id', p_variant_id,
      'quantity_released', p_quantity,
      'old_reserved', COALESCE(old_reserved_quantity, 0),
      'new_reserved', COALESCE(new_reserved_quantity, 0)
    ),
    NULL
  );
  
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

-- إضافة trigger لتحرير المخزون التلقائي عند حذف الطلبات
CREATE OR REPLACE FUNCTION public.auto_release_stock_on_order_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
  release_result jsonb;
BEGIN
  -- تحرير المخزون المحجوز تلقائياً عند حذف طلب قيد التجهيز
  IF OLD.status = 'pending' THEN
    -- الحصول على جميع عناصر الطلب المحذوف
    FOR item_record IN 
      SELECT product_id, variant_id, quantity
      FROM public.order_items
      WHERE order_id = OLD.id
    LOOP
      -- تحرير المخزون لكل عنصر
      SELECT public.release_stock_item(
        item_record.product_id, 
        item_record.variant_id, 
        item_record.quantity
      ) INTO release_result;
      
      RAISE NOTICE 'تم تحرير المخزون تلقائياً للطلب المحذوف: %', release_result;
    END LOOP;
    
    -- إضافة إشعار عام للمديرين
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      data,
      user_id
    ) VALUES (
      'طلب محذوف',
      'تم حذف الطلب ' || COALESCE(OLD.order_number, OLD.id::text) || ' وتحرير المخزون المحجوز تلقائياً',
      'order_deleted',
      'medium',
      jsonb_build_object('order_id', OLD.id, 'order_number', OLD.order_number),
      NULL
    );
  END IF;
  
  RETURN OLD;
END;
$function$;

-- ربط الـ trigger بجدول الطلبات
DROP TRIGGER IF EXISTS auto_release_stock_on_delete ON public.orders;
CREATE TRIGGER auto_release_stock_on_delete
    BEFORE DELETE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_release_stock_on_order_delete();