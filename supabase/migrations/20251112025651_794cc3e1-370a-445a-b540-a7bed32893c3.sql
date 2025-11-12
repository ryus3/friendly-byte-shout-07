-- تصحيح الطلبات المُسلّمة (delivery_status='4') التي لا تزال in_delivery
UPDATE orders 
SET status = 'delivered', 
    status_changed_at = now()
WHERE delivery_status = '4' 
  AND status = 'in_delivery';