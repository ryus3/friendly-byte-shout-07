-- ✅ إصلاح جذري: تصحيح جميع الطلبات بـ delivery_status='4' إلى delivered
UPDATE orders 
SET status = 'delivered', 
    status_changed_at = now()
WHERE delivery_status = '4' 
  AND status != 'delivered' 
  AND status != 'completed';

-- ✅ تصحيح الطلبات بـ delivery_status='17' إلى returned_in_stock
UPDATE orders 
SET status = 'returned_in_stock', 
    status_changed_at = now()
WHERE delivery_status = '17' 
  AND status != 'returned_in_stock';