-- تحديث الطلب 112066293: status + final_amount
UPDATE orders
SET 
  status = 'partial_delivery',
  final_amount = 33000,
  updated_at = NOW()
WHERE tracking_number = '112066293';