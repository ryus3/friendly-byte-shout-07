-- Fix Al-Waseet orders 98783797 and 98831632 per standardized status rules

-- 1) Correct internal status for 98783797 to 'returned' (راجع)
UPDATE public.orders
SET status = 'returned', isArchived = COALESCE(isArchived, false), updated_at = now()
WHERE tracking_number = '98783797';

-- 2) Ensure stock is reserved for both orders (idempotent via function logic)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oi.product_id, oi.variant_id, oi.quantity
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.tracking_number IN ('98783797','98831632')
  LOOP
    PERFORM public.reserve_stock_for_order(
      p_product_id := r.product_id,
      p_variant_id := r.variant_id,
      p_quantity   := r.quantity
    );
  END LOOP;
END $$;