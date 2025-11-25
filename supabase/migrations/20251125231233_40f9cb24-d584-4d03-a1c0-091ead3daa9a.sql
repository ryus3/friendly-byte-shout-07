-- Fix 'column reference quantity is ambiguous' error in process_returned_order_inventory
-- إصلاح خطأ "column reference 'quantity' is ambiguous" في دالة process_returned_order_inventory

DROP FUNCTION IF EXISTS public.process_returned_order_inventory() CASCADE;

CREATE OR REPLACE FUNCTION public.process_returned_order_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- تحديد الجداول بوضوح: i.quantity و i.reserved_quantity بدلاً من quantity و reserved_quantity
  UPDATE inventory i
  SET 
    quantity = i.quantity + oi.quantity,
    reserved_quantity = GREATEST(0, i.reserved_quantity - oi.quantity),
    updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = NEW.id
    AND oi.variant_id = i.variant_id
    AND NEW.status = 'returned_in_stock'
    AND OLD.status != 'returned_in_stock';
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS trigger_process_returned_inventory ON orders;

CREATE TRIGGER trigger_process_returned_inventory
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'returned_in_stock' AND OLD.status IS DISTINCT FROM 'returned_in_stock')
  EXECUTE FUNCTION process_returned_order_inventory();

COMMENT ON FUNCTION public.process_returned_order_inventory() IS 
'إصلاح خطأ ambiguous column - تحديد أسماء الأعمدة بوضوح مع الجداول (i.quantity, i.reserved_quantity)';