-- إضافة حقل الأرشفة للطلبات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS isArchived boolean DEFAULT false;

-- إضافة فهرس للبحث السريع في الطلبات المؤرشفة
CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(isArchived);

-- تحديث الطلبات الموجودة التي في حالة "راجع للمخزن" لتصبح مؤرشفة
UPDATE orders 
SET isArchived = true 
WHERE status = 'returned_in_stock' AND isArchived = false;