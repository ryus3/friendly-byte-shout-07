-- ✅ 1. تحديث CHECK constraint لإضافة partial_delivery كنوع طلب
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE orders
ADD CONSTRAINT orders_order_type_check
CHECK (order_type IN ('regular', 'return', 'partial_delivery', 'incoming'));

-- ✅ 2. تحويل الطلبات الموجودة من is_partial_delivery = TRUE إلى order_type = 'partial_delivery'
UPDATE orders
SET 
  order_type = 'partial_delivery',
  updated_at = NOW()
WHERE is_partial_delivery = TRUE;

-- ✅ 3. اختبار الطلب 112066293 - تحويله لـ partial_delivery
UPDATE orders
SET 
  order_type = 'partial_delivery',
  is_partial_delivery = TRUE,
  updated_at = NOW()
WHERE tracking_number = 'RYUS-112066293';