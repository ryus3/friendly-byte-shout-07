-- 🔥 إصلاح شامل لحالات الطلبات المتأثرة بخطأ المزامنة

-- 1️⃣ تصحيح جميع الطلبات بـ delivery_status='4' إلى delivered
UPDATE orders 
SET status = 'delivered', 
    status_changed_at = now()
WHERE delivery_status = '4' 
  AND status NOT IN ('delivered', 'completed')
  AND status IS NOT NULL;

-- 2️⃣ تصحيح جميع الطلبات بـ delivery_status='1' إلى pending
UPDATE orders 
SET status = 'pending', 
    status_changed_at = now()
WHERE delivery_status = '1' 
  AND status NOT IN ('pending', 'completed')
  AND status IS NOT NULL;

-- 3️⃣ تصحيح جميع الطلبات بـ delivery_status='17' إلى returned_in_stock
UPDATE orders 
SET status = 'returned_in_stock', 
    status_changed_at = now()
WHERE delivery_status = '17' 
  AND status != 'returned_in_stock'
  AND status IS NOT NULL;

-- 4️⃣ تصحيح جميع الطلبات بـ delivery_status='31' أو '32' إلى cancelled
UPDATE orders 
SET status = 'cancelled', 
    status_changed_at = now()
WHERE delivery_status IN ('31', '32')
  AND status != 'cancelled'
  AND status IS NOT NULL;