-- Fix the three problematic orders
UPDATE orders 
SET status = 'cancelled', updated_at = now()
WHERE order_number IN ('ORD000010', 'ORD000009') 
AND delivery_status = 'ملغي' 
AND status = 'unknown';

UPDATE orders 
SET status = 'pending', updated_at = now()
WHERE order_number = 'ORD000007' 
AND delivery_status = 'فعال' 
AND status = 'unknown';