-- Fix ORD000013 delivery fee and final amount
UPDATE public.orders
SET 
  delivery_fee = 5000,
  final_amount = 20000,
  updated_at = now()
WHERE order_number = 'ORD000013';