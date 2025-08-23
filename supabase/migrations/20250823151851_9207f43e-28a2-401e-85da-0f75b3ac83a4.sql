-- Fix delivery_status for local orders - should be null
UPDATE orders 
SET delivery_status = NULL 
WHERE delivery_partner = 'محلي' OR tracking_number LIKE 'RYUS-%';