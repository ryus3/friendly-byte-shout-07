-- 1. Drop الـ constraint القديم أولاً
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. تصحيح جميع الطلبات بحالة 'in_delivery' إلى 'delivery'
UPDATE orders 
SET status = 'delivery', 
    status_changed_at = now()
WHERE status = 'in_delivery';

-- 3. تصحيح الطلبات المُسلّمة (delivery_status='4')
UPDATE orders 
SET status = 'delivered', 
    status_changed_at = now()
WHERE delivery_status = '4' 
  AND status NOT IN ('delivered', 'completed');

-- 4. تصحيح الطلبات المُرجعة (delivery_status='17')
UPDATE orders 
SET status = 'returned_in_stock', 
    status_changed_at = now()
WHERE delivery_status = '17' 
  AND status != 'returned_in_stock';

-- 5. إضافة constraint جديد يشمل 'delivery' بدلاً من 'in_delivery'
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'shipped', 'delivery', 'delivered', 'returned', 'returned_in_stock', 'cancelled', 'completed'));

-- 6. تقرير: عرض عدد الطلبات بعد التحديث
SELECT 
  'تم تحديث الحالات بنجاح' as message,
  (SELECT COUNT(*) FROM orders WHERE status = 'delivery') as delivery_count,
  (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as delivered_count,
  (SELECT COUNT(*) FROM orders WHERE status = 'returned_in_stock') as returned_count;