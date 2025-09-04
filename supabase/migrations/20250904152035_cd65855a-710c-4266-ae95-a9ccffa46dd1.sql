-- Fix the tuple update conflict in triggers
-- The issue is likely that the loyalty points trigger and receipt trigger 
-- are both updating the same row, causing a conflict

-- Drop and recreate the loyalty points trigger as AFTER instead of BEFORE
DROP TRIGGER IF EXISTS add_loyalty_points_on_order_completion_trigger ON orders;

-- Recreate as AFTER trigger to avoid conflicts
CREATE TRIGGER add_loyalty_points_on_order_completion_trigger
  AFTER UPDATE OF status, final_amount
  ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION add_loyalty_points_on_order_completion();

-- Also ensure the receipt trigger is BEFORE to handle status changes first
DROP TRIGGER IF EXISTS handle_receipt_received_order_trigger ON orders;

CREATE TRIGGER handle_receipt_received_order_trigger
  BEFORE UPDATE OF receipt_received
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_received_order();