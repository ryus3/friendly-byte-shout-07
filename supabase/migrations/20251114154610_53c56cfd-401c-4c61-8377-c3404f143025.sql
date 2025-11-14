-- تصحيح الحالات القديمة أولاً
UPDATE orders SET status = 'delivered' WHERE status IN ('delivery', 'completed', 'shipped', 'returned_in_stock');

-- الآن حذف القيد القديم وإضافة القيد الجديد
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- إضافة القيد الجديد الذي يتضمن partial_delivery
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'processing', 'delivered', 'returned', 'cancelled', 'partial_delivery'));

-- تصحيح بيانات الطلب 112066293
UPDATE orders
SET 
  status = 'partial_delivery',
  discount = 0,
  total_amount = 28000,  -- سعر المنتج M المُسلّم فقط
  final_amount = 33000,   -- 28,000 + 5,000 رسوم توصيل
  updated_at = NOW()
WHERE tracking_number = '112066293';