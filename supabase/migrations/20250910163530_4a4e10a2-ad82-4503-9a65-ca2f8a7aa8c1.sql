-- Fix ORD000013 amounts to show correct total including delivery
UPDATE public.orders
SET
  delivery_fee = 5000,
  final_amount = 20000,
  total_amount = 20000,
  updated_at = now()
WHERE order_number = 'ORD000013';