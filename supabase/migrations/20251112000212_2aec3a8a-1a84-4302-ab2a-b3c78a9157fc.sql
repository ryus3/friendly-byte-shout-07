-- تصحيح الطلبات ذات الحالة الخاطئة
-- الطلبات بحالة delivery_status='4' يجب أن تكون status='delivered'
UPDATE orders 
SET 
  status = 'delivered',
  updated_at = now()
WHERE delivery_status = '4' 
  AND status NOT IN ('delivered', 'completed');

-- تصحيح reserved_quantity السالب
UPDATE inventory
SET reserved_quantity = 0,
    updated_at = now()
WHERE reserved_quantity < 0;