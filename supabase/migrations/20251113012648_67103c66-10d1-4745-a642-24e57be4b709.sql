-- 🔥 إعادة تشغيل SQL Migration بعد deployment الكود الجديد + إصلاح المخزون

-- 1️⃣ تصحيح جميع الطلبات بـ delivery_status='4' إلى delivered
UPDATE orders 
SET status = 'delivered', 
    status_changed_at = now()
WHERE delivery_status = '4' 
  AND status NOT IN ('delivered', 'completed');

-- 2️⃣ تصحيح جميع الطلبات بـ delivery_status='1' إلى pending
UPDATE orders 
SET status = 'pending', 
    status_changed_at = now()
WHERE delivery_status = '1' 
  AND status NOT IN ('pending', 'completed');

-- 3️⃣ تصحيح جميع الطلبات بـ delivery_status='17' إلى returned_in_stock
UPDATE orders 
SET status = 'returned_in_stock', 
    status_changed_at = now()
WHERE delivery_status = '17' 
  AND status != 'returned_in_stock';

-- 4️⃣ تصحيح جميع الطلبات بـ delivery_status='31' أو '32' إلى cancelled
UPDATE orders 
SET status = 'cancelled', 
    status_changed_at = now()
WHERE delivery_status IN ('31', '32')
  AND status != 'cancelled';

-- 🔥🔥 إصلاح المخزون السالب والبيع بالسالب

-- 1️⃣ تصفير جميع reserved_quantity السالب
UPDATE inventory 
SET reserved_quantity = 0,
    updated_at = now()
WHERE reserved_quantity < 0;

-- 2️⃣ تصحيح البيع بالسالب (quantity < 0)
UPDATE inventory 
SET quantity = 0,
    reserved_quantity = 0,
    updated_at = now()
WHERE quantity < 0;

-- 3️⃣ تصحيح overselling (quantity < reserved_quantity)
UPDATE inventory 
SET quantity = reserved_quantity,
    updated_at = now()
WHERE quantity < reserved_quantity;

-- 4️⃣ إعادة حساب reserved_quantity بدقة 100% من الطلبات النشطة
WITH active_reservations AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status IN ('pending', 'shipped', 'delivery', 'returned')
    AND o.order_type != 'return'
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET reserved_quantity = COALESCE(ar.total_reserved, 0),
    updated_at = now()
FROM active_reservations ar
WHERE i.variant_id = ar.variant_id;

-- 5️⃣ تصفير reserved_quantity للمنتجات بدون طلبات نشطة
UPDATE inventory i
SET reserved_quantity = 0,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1 FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.variant_id = i.variant_id
    AND o.status IN ('pending', 'shipped', 'delivery', 'returned')
    AND o.order_type != 'return'
);

-- 6️⃣ التحقق النهائي: إذا كان quantity < reserved_quantity بعد إعادة الحساب، نضبط quantity = reserved_quantity
UPDATE inventory 
SET quantity = reserved_quantity,
    updated_at = now()
WHERE quantity < reserved_quantity;

-- 7️⃣ إضافة CHECK constraints دائمة بعد تصحيح جميع البيانات
ALTER TABLE inventory 
DROP CONSTRAINT IF EXISTS check_reserved_non_negative;

ALTER TABLE inventory 
DROP CONSTRAINT IF EXISTS check_quantity_enough_for_reserved;

ALTER TABLE inventory 
DROP CONSTRAINT IF EXISTS check_quantity_non_negative;

ALTER TABLE inventory 
ADD CONSTRAINT check_reserved_non_negative 
CHECK (reserved_quantity >= 0);

ALTER TABLE inventory 
ADD CONSTRAINT check_quantity_enough_for_reserved 
CHECK (quantity >= reserved_quantity);

ALTER TABLE inventory 
ADD CONSTRAINT check_quantity_non_negative 
CHECK (quantity >= 0);