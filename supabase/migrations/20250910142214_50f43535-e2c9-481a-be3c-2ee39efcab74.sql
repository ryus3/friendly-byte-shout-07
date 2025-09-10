-- Fix inconsistent sales amount for ORD000010 to match actual product price (21,000)
UPDATE public.orders
SET 
  sales_amount = 21000,
  total_amount = 21000,
  updated_at = now()
WHERE order_number = 'ORD000010';