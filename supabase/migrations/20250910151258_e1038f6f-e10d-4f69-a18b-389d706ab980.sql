-- إصلاح بيانات طلب ORD000013 فوراً
UPDATE public.orders 
SET 
  delivery_fee = 5000,
  final_amount = 20000,
  updated_at = now()
WHERE order_number = 'ORD000013';

-- التحقق من النتيجة
SELECT 
  order_number,
  sales_amount,
  delivery_fee, 
  final_amount,
  total_amount
FROM public.orders 
WHERE order_number = 'ORD000013';