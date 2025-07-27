-- إزالة دالة التنظيف اليدوية واستبدالها بنظام تلقائي
DROP FUNCTION IF EXISTS public.cleanup_orphaned_reserved_stock();

-- إضافة دالة تنظيف تلقائية للمخزون المحجوز "اليتيم"
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
  
  -- إضافة إشعار إذا تم تنظيف أي عناصر
  IF cleanup_count > 0 THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      data,
      user_id
    ) VALUES (
      'تنظيف تلقائي للمخزون',
      'تم تنظيف ' || cleanup_count || ' عنصر من المخزون المحجوز تلقائياً',
      'inventory_cleanup',
      'low',
      jsonb_build_object('cleaned_items', cleanup_count, 'trigger', 'auto_cleanup'),
      NULL
    );
    
    RAISE NOTICE 'تم تنظيف % عنصر من المخزون المحجوز تلقائياً', cleanup_count;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إضافة trigger للتنظيف التلقائي عند تحديث حالة الطلبات
CREATE OR REPLACE TRIGGER auto_inventory_cleanup
    AFTER UPDATE OF status ON public.orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_cleanup_orphaned_reserved_stock();

-- إضافة trigger للتنظيف التلقائي عند حذف عناصر الطلبات
CREATE OR REPLACE TRIGGER auto_inventory_cleanup_on_item_delete
    AFTER DELETE ON public.order_items
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_cleanup_orphaned_reserved_stock();