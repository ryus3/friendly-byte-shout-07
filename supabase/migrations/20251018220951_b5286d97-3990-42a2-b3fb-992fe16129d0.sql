-- إصلاح sales_amount للطلب 108119289
UPDATE orders
SET 
  sales_amount = total_amount - discount,
  updated_at = now()
WHERE tracking_number = '108119289';