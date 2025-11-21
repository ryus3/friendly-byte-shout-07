-- تصحيح final_amount للطلب 112066293 بناءً على partial_delivery_history
UPDATE orders 
SET 
  final_amount = 33000,
  updated_at = NOW()
WHERE id = '37116ee2-7931-4674-9db6-9abccf21954a';

-- التحقق النهائي
SELECT 
  tracking_number,
  order_type,
  status,
  delivery_status,
  final_amount AS final_corrected,
  total_amount
FROM orders
WHERE id = '37116ee2-7931-4674-9db6-9abccf21954a';