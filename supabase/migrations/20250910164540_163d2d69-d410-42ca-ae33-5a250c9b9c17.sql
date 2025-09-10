-- Correct ORD000013 amounts after incorrect previous migration
UPDATE public.orders
SET
  total_amount = 19000,         -- product price before discount
  final_amount = 15000,         -- after 4,000 discount
  delivery_fee = 5000,          -- delivery fee remains 5,000
  updated_at = now()
WHERE order_number = 'ORD000013';