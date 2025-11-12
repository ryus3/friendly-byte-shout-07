-- ✅ إصلاح نهائي جذري: الحالة 4 = delivered فقط
-- تصحيح جميع الطلبات بـ delivery_status='4' إلى delivered
UPDATE orders 
SET status = 'delivered', 
    status_changed_at = now()
WHERE delivery_status = '4' 
  AND status NOT IN ('delivered', 'completed');

-- تصحيح جميع الطلبات بـ delivery_status='17' إلى returned_in_stock
UPDATE orders 
SET status = 'returned_in_stock', 
    status_changed_at = now()
WHERE delivery_status = '17' 
  AND status NOT IN ('returned_in_stock', 'completed');

-- تصحيح total_amount لطلب 111736263 (28000 + 5000 توصيل = 33000)
UPDATE orders 
SET total_amount = 33000
WHERE tracking_number = '111736263';