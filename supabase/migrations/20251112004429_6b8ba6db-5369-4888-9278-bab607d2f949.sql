-- تحديث نظام الحالات: إصلاح 'delivery' → 'in_delivery'

-- 1️⃣ حذف القيد القديم
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2️⃣ تصحيح جميع الطلبات بحالات غير صحيحة
UPDATE orders
SET status = CASE
  WHEN delivery_status = '4' THEN 'delivered'
  WHEN delivery_status = '17' THEN 'returned_in_stock'
  WHEN delivery_status IN ('31', '32') THEN 'cancelled'
  WHEN delivery_status IN ('2', '7', '8', '9', '10', '11') THEN 'shipped'
  WHEN delivery_status IN ('3', '5', '6', '14', '15', '16', '18', '22', '23', '24', '25', '26', '27', '28', '29', '30', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') THEN 'in_delivery'
  WHEN delivery_status IN ('12', '13', '19', '20', '21') THEN 'returned'
  ELSE 'pending'
END
WHERE status NOT IN ('pending', 'shipped', 'in_delivery', 'delivered', 'returned', 'returned_in_stock', 'cancelled');

-- 3️⃣ إضافة القيد الجديد
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'shipped', 'in_delivery', 'delivered', 'returned', 'returned_in_stock', 'cancelled'));

-- 4️⃣ تصحيح المخزون السالب + منع البيع بالسالب
UPDATE inventory SET reserved_quantity = 0 WHERE reserved_quantity < 0;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_reserved_non_negative') THEN
    ALTER TABLE inventory ADD CONSTRAINT check_reserved_non_negative CHECK (reserved_quantity >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_quantity_enough_for_reserved') THEN
    ALTER TABLE inventory ADD CONSTRAINT check_quantity_enough_for_reserved CHECK (quantity >= reserved_quantity);
  END IF;
END $$;