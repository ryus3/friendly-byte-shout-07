-- تصحيح final_amount للطلب 112066293 ليطابق delivered_revenue
UPDATE orders 
SET final_amount = 33000
WHERE id = '37116ee2-7931-4674-9db6-9abccf21954a';

-- التحقق النهائي من كلا الطلبين
SELECT 
  tracking_number,
  order_type,
  status,
  final_amount,
  delivery_status
FROM orders
WHERE delivery_partner_order_id IN ('112552848', '112066293')
ORDER BY tracking_number;