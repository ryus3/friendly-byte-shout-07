-- إزالة الإشعارات غير المرغوب فيها من دوال التنظيف
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
    
    -- بدون إشعارات للمستخدمين - التنظيف تلقائي وصامت
  END IF;
  
  RETURN OLD;
END;
$function$;

-- تحديث دالة التنظيف التلقائي لتكون صامتة
CREATE OR REPLACE FUNCTION public.auto_cleanup_orphaned_reserved_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cleanup_count INTEGER := 0;
BEGIN
  -- تنظيف المخزون المحجوز للطلبات غير الموجودة أو المكتملة/الملغية
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
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- تنظيف صامت - بدون إشعارات للمستخدمين
  IF cleanup_count > 0 THEN
    RAISE NOTICE 'تم تنظيف % عنصر من المخزون المحجوز تلقائياً', cleanup_count;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- تفعيل realtime للمخزون لجعل التحديثات لحظية
ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.inventory;