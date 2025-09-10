-- إصلاح بيانات طلب ORD000013
UPDATE public.orders 
SET 
  delivery_fee = 5000,
  final_amount = 20000
WHERE order_number = 'ORD000013';