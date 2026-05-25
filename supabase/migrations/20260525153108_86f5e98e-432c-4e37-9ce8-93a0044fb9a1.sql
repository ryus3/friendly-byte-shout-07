ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_final_amount_min_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_amounts_sane_check
  CHECK (
    total_amount IS NOT NULL
    AND final_amount IS NOT NULL
    AND delivery_fee IS NOT NULL
    AND COALESCE(delivery_fee, 0) >= 0
    AND COALESCE(discount, 0) >= 0
    AND (
      order_type IN ('return', 'replacement', 'exchange', 'partial_delivery')
      OR final_amount >= 0
    )
  );