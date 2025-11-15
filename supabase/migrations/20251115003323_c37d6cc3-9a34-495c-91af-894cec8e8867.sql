-- المرحلة 2: تحديث حالة الطلب 112066293 إلى partial_delivery
UPDATE orders
SET 
  status = 'partial_delivery',
  updated_at = NOW()
WHERE tracking_number = '112066293';