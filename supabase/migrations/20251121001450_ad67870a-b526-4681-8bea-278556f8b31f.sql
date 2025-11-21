-- 1️⃣ تصحيح status من 'returned' إلى 'delivery' للطلبين
UPDATE orders 
SET 
  status = 'delivery',
  updated_at = now()
WHERE delivery_partner_order_id IN ('112552848', '112066293')
  AND order_type = 'partial_delivery'
  AND status = 'returned';

-- 2️⃣ تصحيح final_amount للطلب 112066293 من 38000 إلى 33000
UPDATE orders 
SET 
  final_amount = 33000,
  updated_at = now()
WHERE delivery_partner_order_id = '112066293'
  AND order_type = 'partial_delivery'
  AND final_amount = 38000;

-- 3️⃣ التحقق من النتيجة
SELECT 
  tracking_number,
  delivery_partner_order_id,
  order_type,
  status,
  total_amount,
  final_amount,
  delivery_status,
  delivery_fee
FROM orders
WHERE delivery_partner_order_id IN ('112552848', '112066293')
ORDER BY created_at DESC;