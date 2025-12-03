-- تصحيح الطلبات التي مرّت بالحالة 21 ولم يُحدّث order_type
UPDATE orders 
SET order_type = 'partial_delivery'
WHERE tracking_number IN ('115472411', '115458722')
  AND (order_type IS NULL OR order_type != 'partial_delivery');