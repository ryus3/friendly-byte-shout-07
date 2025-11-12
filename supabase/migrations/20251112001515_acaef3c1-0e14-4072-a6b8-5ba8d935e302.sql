-- تصحيح الطلبات ذات الحالة الخاطئة فوراً
UPDATE orders
SET status = CASE
  WHEN delivery_status = '4' THEN 'delivered'
  WHEN delivery_status = '17' THEN 'returned_in_stock'
  WHEN delivery_status IN ('31', '32') THEN 'cancelled'
  ELSE status
END,
updated_at = NOW()
WHERE delivery_status IN ('4', '17', '31', '32')
  AND status NOT IN ('delivered', 'returned_in_stock', 'cancelled');

-- تصحيح المخزون المحجوز السالب
UPDATE inventory
SET reserved_quantity = 0
WHERE reserved_quantity < 0;