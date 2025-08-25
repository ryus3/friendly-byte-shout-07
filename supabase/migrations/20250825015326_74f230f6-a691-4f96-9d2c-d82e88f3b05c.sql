-- 1) Tables for mirroring delivery partner invoices
-- Create delivery_invoices and delivery_invoice_orders with RLS and triggers

-- Ensure helper function for updated_at exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- delivery_invoices
CREATE TABLE IF NOT EXISTS public.delivery_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE, -- partner invoice id
  partner TEXT NOT NULL DEFAULT 'alwaseet',
  status TEXT,
  received BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC,
  orders_count INTEGER,
  issued_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_partner ON public.delivery_invoices (partner);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_received ON public.delivery_invoices (received);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_issued_at ON public.delivery_invoices (issued_at DESC);

-- Triggers for timestamps
DROP TRIGGER IF EXISTS trg_delivery_invoices_updated_at ON public.delivery_invoices;
CREATE TRIGGER trg_delivery_invoices_updated_at
BEFORE UPDATE ON public.delivery_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS and policies
ALTER TABLE public.delivery_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'delivery_invoices' AND policyname = 'Authenticated can view delivery_invoices'
  ) THEN
    CREATE POLICY "Authenticated can view delivery_invoices"
    ON public.delivery_invoices
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
-- No insert/update/delete by clients; service role (Edge Functions) bypasses RLS

-- delivery_invoice_orders
CREATE TABLE IF NOT EXISTS public.delivery_invoice_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.delivery_invoices(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  external_order_id TEXT, -- partner order id/tracking
  status TEXT,
  amount NUMERIC,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, external_order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dio_invoice_id ON public.delivery_invoice_orders (invoice_id);
CREATE INDEX IF NOT EXISTS idx_dio_order_id ON public.delivery_invoice_orders (order_id);

-- Triggers for timestamps
DROP TRIGGER IF EXISTS trg_delivery_invoice_orders_updated_at ON public.delivery_invoice_orders;
CREATE TRIGGER trg_delivery_invoice_orders_updated_at
BEFORE UPDATE ON public.delivery_invoice_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS and policies
ALTER TABLE public.delivery_invoice_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'delivery_invoice_orders' AND policyname = 'Authenticated can view delivery_invoice_orders'
  ) THEN
    CREATE POLICY "Authenticated can view delivery_invoice_orders"
    ON public.delivery_invoice_orders
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 2) Trigger: when an invoice becomes received=true, mark linked orders as receipt_received
CREATE OR REPLACE FUNCTION public.propagate_invoice_received_to_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  IF NEW.received = true AND COALESCE(OLD.received, false) = false THEN
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_received_propagation ON public.delivery_invoices;
CREATE TRIGGER trg_invoice_received_propagation
AFTER UPDATE ON public.delivery_invoices
FOR EACH ROW EXECUTE FUNCTION public.propagate_invoice_received_to_orders();

-- 3) Optional: helper view for quick reporting
CREATE OR REPLACE VIEW public.v_delivery_invoices_summary AS
SELECT 
  di.id,
  di.external_id,
  di.partner,
  di.status,
  di.received,
  di.amount,
  di.orders_count,
  di.issued_at,
  di.received_at,
  di.created_at,
  di.updated_at,
  COUNT(dio.id) AS linked_orders,
  COUNT(dio.order_id) FILTER (WHERE dio.order_id IS NOT NULL) AS linked_local_orders
FROM public.delivery_invoices di
LEFT JOIN public.delivery_invoice_orders dio ON dio.invoice_id = di.id
GROUP BY di.id;

-- 4) Schedule cron to call the sync function every 5 minutes (if pg_cron/pg_net are enabled)
-- Clean existing schedule if exists
DO $$ BEGIN
  PERFORM cron.unschedule('sync-alwaseet-invoices-5min');
EXCEPTION WHEN undefined_function THEN
  -- cron not available; ignore
  NULL;
END $$;

-- Create schedule
DO $$ BEGIN
  PERFORM cron.schedule(
    'sync-alwaseet-invoices-5min',
    '*/5 * * * *',
    $$
    select net.http_post(
      url := 'https://tkheostkubborwkwzugl.functions.supabase.co/sync-alwaseet-invoices',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
      body := jsonb_build_object('source','cron','now', now())
    );
    $$
  );
EXCEPTION WHEN undefined_function THEN
  -- pg_cron or pg_net not available; ignore, will run manually
  NULL;
END $$;
