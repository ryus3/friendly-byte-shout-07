-- Safely remove duplicate reserve stock trigger while keeping the canonical one
-- and add a diagnostic helper to inspect current reservation-related triggers.

-- 1) Drop duplicate trigger only if BOTH exist on the same table
DO $$
DECLARE
  v_has_generic boolean := false;
  v_has_on_create boolean := false;
BEGIN
  -- Check on public.order_items
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND c.relname = 'order_items'
      AND t.tgname = 'reserve_stock_trigger'
  ) INTO v_has_generic;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND c.relname = 'order_items'
      AND t.tgname = 'reserve_stock_on_order_create_trigger'
  ) INTO v_has_on_create;

  IF v_has_generic AND v_has_on_create THEN
    EXECUTE 'DROP TRIGGER IF EXISTS reserve_stock_trigger ON public.order_items';
    RAISE NOTICE 'Dropped duplicate trigger reserve_stock_trigger on public.order_items (kept reserve_stock_on_order_create_trigger)';
  ELSE
    RAISE NOTICE 'No duplicate reserve triggers found to drop on public.order_items';
  END IF;
END $$;

-- 2) Provide a diagnostic helper to list reservation-related triggers in public schema
CREATE OR REPLACE FUNCTION public.debug_reservation_triggers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
BEGIN
  result := (
    SELECT jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'trigger', t.tgname,
      'function', p.proname,
      'enabled', NOT t.tgenabled = 'D'
    ))
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND (
        t.tgname ILIKE 'reserve%stock%'
        OR p.proname ILIKE '%reserve%stock%'
        OR t.tgname ILIKE 'release%stock%'
        OR p.proname ILIKE '%release%stock%'
      )
  );

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
