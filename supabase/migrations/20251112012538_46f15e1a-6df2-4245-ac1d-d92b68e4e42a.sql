-- ✅ تحديث orders_status_check constraint ليشمل 'completed'

-- 1️⃣ حذف الـ constraint القديم
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2️⃣ إضافة constraint جديد يشمل جميع الحالات الصحيحة
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'shipped', 'in_delivery', 'delivered', 'returned', 'returned_in_stock', 'cancelled', 'completed'));