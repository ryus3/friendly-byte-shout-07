-- Fix: Set views to run with invoker privileges so RLS of the querying user is enforced
-- This addresses linter rule 0010_security_definer_view

-- Ensure views in public schema use security_invoker=true
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname = 'delivery_invoices_needing_sync'
  ) THEN
    EXECUTE 'ALTER VIEW public.delivery_invoices_needing_sync SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname = 'orders_invoice_receipt_v'
  ) THEN
    EXECUTE 'ALTER VIEW public.orders_invoice_receipt_v SET (security_invoker = true)';
  END IF;
END
$$;