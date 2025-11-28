-- Fix auto_release_stock_on_order_delete trigger function to use item_direction instead of nonexistent OLD.direction
-- and ensure safe reserved_quantity release on order delete

-- 1) Create or replace the function with correct logic
CREATE OR REPLACE FUNCTION public.auto_release_stock_on_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Release reserved stock for all relevant items of the deleted order
  FOR v_item IN 
    SELECT 
      oi.variant_id,
      oi.quantity,
      oi.item_direction,
      oi.item_status
    FROM order_items oi
    WHERE oi.order_id = OLD.id
      -- لا نلمس العناصر التي تم تسليمها فعلياً أو أُعيدت إلى المخزون
      AND oi.item_status NOT IN ('delivered', 'returned_in_stock', 'completed')
      -- استثناء طلبات الاسترجاع الداخلة (incoming returns)
      -- ✅ إصلاح هنا: استخدام oi.item_direction بدلاً من OLD.direction
      AND (OLD.order_type IS DISTINCT FROM 'return' OR oi.item_direction IS DISTINCT FROM 'incoming')
  LOOP
    -- تحديث المخزون المحجوز بأمان (عدم السماح بالسالب)
    UPDATE inventory
    SET 
      reserved_quantity = GREATEST(reserved_quantity - v_item.quantity, 0),
      updated_at = NOW()
    WHERE variant_id = v_item.variant_id;
  END LOOP;

  RETURN OLD;
END;
$$;

-- 2) Ensure a single, correctly wired trigger exists on orders for delete
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON public.orders;

CREATE TRIGGER auto_release_stock_on_order_delete
AFTER DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_release_stock_on_order_delete();
