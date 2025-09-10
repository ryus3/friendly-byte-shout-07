-- Drop duplicate reserve trigger on orders (keep the canonical on_create one)
DO $$
DECLARE
  v_has_generic boolean := false;
  v_has_on_create boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND c.relname = 'orders'
      AND t.tgname = 'reserve_stock_trigger'
  ) INTO v_has_generic;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND c.relname = 'orders'
      AND t.tgname = 'reserve_stock_on_order_create_trigger'
  ) INTO v_has_on_create;

  IF v_has_generic AND v_has_on_create THEN
    EXECUTE 'DROP TRIGGER IF EXISTS reserve_stock_trigger ON public.orders';
    RAISE NOTICE 'Dropped duplicate trigger reserve_stock_trigger on public.orders (kept reserve_stock_on_order_create_trigger)';
  ELSE
    RAISE NOTICE 'No duplicate reserve triggers found to drop on public.orders';
  END IF;
END $$;

-- Correct the double-deducted stock for Barcelona Blue XL
UPDATE public.inventory
SET quantity = quantity + 1, updated_at = now()
WHERE variant_id = '242173d9-3ce1-4f8c-b398-846e16da534a';
