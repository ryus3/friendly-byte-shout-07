-- إصلاح بيانات الطلب ORD000013 نهائياً
UPDATE public.orders 
SET 
  delivery_fee = 5000,
  final_amount = sales_amount + 5000,
  updated_at = now()
WHERE order_number = 'ORD000013';

-- التحقق من الحالة المصححة
SELECT 
  order_number,
  tracking_number,
  sales_amount,
  delivery_fee, 
  final_amount,
  (sales_amount + delivery_fee) as calculated_total
FROM public.orders 
WHERE order_number = 'ORD000013';