-- Fix existing orders with missing delivery_partner_order_id but have tracking_number
-- Update orders 101025896 and 101028161 specifically for testing
UPDATE orders 
SET delivery_partner_order_id = tracking_number,
    updated_at = now()
WHERE delivery_partner = 'alwaseet' 
  AND delivery_partner_order_id IS NULL 
  AND tracking_number IS NOT NULL
  AND tracking_number IN ('101025896', '101028161');