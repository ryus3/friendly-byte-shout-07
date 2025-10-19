-- ==========================================
-- الأولوية 1: إصلاح دالة release_stock_item
-- ==========================================
-- هذه الدالة المحدثة تخصم من المخزون الكلي (quantity) عند التسليم
-- بدلاً من تحرير reserved_quantity فقط

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
  -- ✅ التحرير الصحيح: خصم من quantity الكلي + تحرير reserved_quantity
  UPDATE inventory
  SET 
    quantity = GREATEST(0, quantity - p_quantity),
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    available_quantity = GREATEST(0, quantity - p_quantity - reserved_quantity),
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  -- تسجيل في logs
  RAISE NOTICE 'تم تحرير % من المنتج % (variant: %) - مباع (خصم من المخزون الكلي)', 
    p_quantity, p_product_id, p_variant_id;
END;
$function$;

-- ==========================================
-- الأولوية 4: Trigger للإرجاع التلقائي عند delivery_status = 17
-- ==========================================
-- هذا الـ trigger يُرجع المنتجات غير المسلمة (pending_return) تلقائياً
-- عندما يتغير delivery_status إلى 17 (تم الإرجاع إلى التاجر)

CREATE OR REPLACE FUNCTION public.auto_return_undelivered_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item_record RECORD;
BEGIN
  -- عندما يتغير delivery_status إلى 17 (تم الإرجاع إلى التاجر)
  IF NEW.delivery_status = '17' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '17') THEN
    
    -- تحديث حالة المنتجات غير المسلمة (pending_return) إلى returned
    UPDATE order_items
    SET 
      item_status = 'returned',
      quantity_returned = quantity,
      returned_at = now()
    WHERE order_id = NEW.id
      AND item_status = 'pending_return';
    
    -- إرجاع المخزون لكل منتج غير مسلم
    FOR item_record IN 
      SELECT product_id, variant_id, quantity
      FROM order_items
      WHERE order_id = NEW.id
        AND item_status = 'returned'
        AND quantity_returned IS NOT NULL
        AND quantity_returned > 0
    LOOP
      -- استدعاء دالة return_stock_item لإرجاع المخزون
      PERFORM return_stock_item(
        item_record.product_id,
        item_record.variant_id,
        item_record.quantity
      );
      
      RAISE NOTICE 'تم إرجاع % من المنتج % (variant: %) إلى المخزون', 
        item_record.quantity, item_record.product_id, item_record.variant_id;
    END LOOP;
    
    RAISE NOTICE 'تم إرجاع المنتجات غير المسلمة للطلب % إلى المخزون', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- حذف الـ Trigger القديم إن وجد
DROP TRIGGER IF EXISTS trigger_auto_return_undelivered_items ON orders;

-- ربط الـ Trigger بجدول orders
CREATE TRIGGER trigger_auto_return_undelivered_items
  AFTER UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_return_undelivered_items();