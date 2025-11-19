-- ✅ إصلاح COALESCE في دالة process_returned_order_inventory
-- المشكلة: COALESCE يخلط uuid مع text
-- الحل: تحويل الكل إلى text

CREATE OR REPLACE FUNCTION public.process_returned_order_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  order_item RECORD;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock') THEN
    FOR order_item IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      -- ✅ تحديث المخزون الفعلي في جدول inventory
      UPDATE inventory
      SET 
        quantity = quantity + order_item.quantity,
        updated_at = now(),
        last_updated_by = COALESCE(NEW.created_by::text, (auth.uid())::text)
      WHERE variant_id = order_item.variant_id;
      
      -- حذف من سجل المبيعات إذا كان موجوداً
      DELETE FROM sold_products_log
      WHERE order_id = NEW.id AND variant_id = order_item.variant_id;
      
      RAISE NOTICE '✅ تم إرجاع % وحدة من المنتج % للمخزون الفعلي', order_item.quantity, order_item.variant_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;