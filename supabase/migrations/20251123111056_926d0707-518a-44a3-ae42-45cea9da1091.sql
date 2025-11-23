-- Fix: Remove incorrect trigger from orders table and create correct one on order_items

-- Step 1: Drop the incorrect trigger from orders table
DROP TRIGGER IF EXISTS update_inventory_reserved_on_order_change ON orders;

-- Step 2: Create the correct trigger on order_items table
-- This is where variant_id actually exists
CREATE TRIGGER update_inventory_reserved_on_order_change
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_reserved_quantity();

-- Comment for clarity
COMMENT ON TRIGGER update_inventory_reserved_on_order_change ON order_items IS 
'Updates inventory reserved_quantity when order items are created, modified, or deleted';
