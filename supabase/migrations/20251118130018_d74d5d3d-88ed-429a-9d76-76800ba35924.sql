-- إصلاح نهائي للسعر - تشغيل UPDATE مباشر
UPDATE orders
SET final_amount = 33000
WHERE tracking_number = '112066293'
  AND is_partial_delivery = TRUE
RETURNING tracking_number, status, final_amount, is_partial_delivery;