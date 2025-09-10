-- Ensure delivery_fee is set correctly for ORD000013
UPDATE public.orders
SET delivery_fee = 5000,
    updated_at = now()
WHERE order_number = 'ORD000013';

-- Optional: recalc cached fields if any exist (no-op for now)