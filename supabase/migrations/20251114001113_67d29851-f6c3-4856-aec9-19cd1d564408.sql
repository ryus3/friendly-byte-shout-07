-- 🔥 إصلاح نهائي شامل: overselling + طلبات الرفض + المخزون المحجوز

-- 1️⃣ Drop constraints مؤقتاً
ALTER TABLE inventory 
DROP CONSTRAINT IF EXISTS check_quantity_enough_for_reserved;

-- 2️⃣ تصحيح overselling (quantity < reserved_quantity)
UPDATE inventory 
SET quantity = reserved_quantity,
    updated_at = now()
WHERE quantity < reserved_quantity;

-- 3️⃣ تصحيح طلبات الرفض (31 و 32) إلى cancelled
UPDATE orders 
SET status = 'cancelled', 
    status_changed_at = now()
WHERE delivery_status IN ('31', '32')
  AND status != 'cancelled';

-- 4️⃣ إعادة حساب reserved_quantity بدقة 100%
-- تصفير الكل أولاً
UPDATE inventory 
SET reserved_quantity = 0,
    updated_at = now();

-- حساب دقيق من الطلبات النشطة
WITH active_reservations AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status IN ('pending', 'shipped', 'delivery', 'returned')
    AND (o.order_type != 'return' OR o.order_type IS NULL)
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET reserved_quantity = ar.total_reserved,
    updated_at = now()
FROM active_reservations ar
WHERE i.variant_id = ar.variant_id;

-- 5️⃣ التحقق النهائي: إذا كان quantity < reserved_quantity بعد إعادة الحساب، نضبط quantity = reserved_quantity
UPDATE inventory 
SET quantity = reserved_quantity,
    updated_at = now()
WHERE quantity < reserved_quantity;

-- 6️⃣ إعادة إضافة constraint
ALTER TABLE inventory 
ADD CONSTRAINT check_quantity_enough_for_reserved 
CHECK (quantity >= reserved_quantity);