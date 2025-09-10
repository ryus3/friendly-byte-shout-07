-- تصحيح بيانات الطلب ORD000013
UPDATE orders 
SET 
  delivery_fee = 5000,
  final_amount = 20000,
  updated_at = now()
WHERE order_number = 'ORD000013';

-- التحقق من التحديث
-- ORD000013 يجب أن يكون:
-- delivery_fee = 5000 
-- final_amount = 20000 (شامل التوصيل)
-- sales_amount = 15000 (بدون التوصيل)