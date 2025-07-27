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