-- إصلاح trigger الحذف التلقائي للطلبات (auto_release_stock_on_order_delete)
-- المشكلة: كان يحاول حفظ نتيجة void في متغير jsonb
-- الحل: استخدام PERFORM بدلاً من SELECT INTO

CREATE OR REPLACE FUNCTION public.auto_release_stock_on_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item_record RECORD;
BEGIN
  -- تحرير المخزون المحجوز تلقائياً عند حذف طلب قيد التجهيز
  IF OLD.status = 'pending' THEN
    -- الحصول على جميع عناصر الطلب المحذوف
    FOR item_record IN 
      SELECT product_id, variant_id, quantity
      FROM public.order_items
      WHERE order_id = OLD.id
    LOOP
      -- استخدام PERFORM بدلاً من SELECT INTO (لأن الدالة ترجع void)
      PERFORM public.release_stock_item(
        item_record.product_id, 
        item_record.variant_id, 
        item_record.quantity
      );
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