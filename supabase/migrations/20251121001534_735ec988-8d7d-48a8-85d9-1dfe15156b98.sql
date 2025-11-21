-- تصحيح final_amount للطلب 112066293 (تحديث مباشر بدون شرط)
UPDATE orders 
SET 
  final_amount = 33000,
  updated_at = now()
WHERE id = '37116ee2-7931-4674-9db6-9abccf21954a';

-- التحقق من التحديث
SELECT 
  tracking_number,
  order_type,
  status,
  final_amount,
  total_amount,
  delivery_fee,
  (total_amount - delivery_fee) as expected_final_amount
FROM orders
WHERE id = '37116ee2-7931-4674-9db6-9abccf21954a';