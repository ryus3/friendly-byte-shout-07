-- 1) Ensure unique index for invoices (external_id, partner) to support ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_invoices_external_partner
ON public.delivery_invoices(external_id, partner);

-- 2) Add derived/normalized fields to delivery_invoices
ALTER TABLE public.delivery_invoices
  ADD COLUMN IF NOT EXISTS status_normalized text,
  ADD COLUMN IF NOT EXISTS received_flag boolean NOT NULL DEFAULT false;

-- 3) Snapshot table for invoice orders
CREATE TABLE IF NOT EXISTS public.delivery_invoice_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.delivery_invoices(id) ON DELETE CASCADE,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  external_order_id text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes and uniqueness for snapshot table
CREATE INDEX IF NOT EXISTS idx_dio_invoice_id ON public.delivery_invoice_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dio_order_id ON public.delivery_invoice_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_dio_external_order_id ON public.delivery_invoice_orders(external_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dio_invoice_external ON public.delivery_invoice_orders(invoice_id, external_order_id);

-- 4) RLS for snapshot table (read-only for authenticated users)
ALTER TABLE public.delivery_invoice_orders ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'delivery_invoice_orders' AND policyname = 'Authenticated can view delivery_invoice_orders'
  ) THEN
    CREATE POLICY "Authenticated can view delivery_invoice_orders"
      ON public.delivery_invoice_orders
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END$$;

-- 5) Status history table
CREATE TABLE IF NOT EXISTS public.delivery_invoice_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.delivery_invoices(id) ON DELETE CASCADE,
  old_status text,
  new_status text,
  old_status_normalized text,
  new_status_normalized text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for history (read-only for authenticated users)
ALTER TABLE public.delivery_invoice_status_history ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'delivery_invoice_status_history' AND policyname = 'Authenticated can view delivery_invoice_status_history'
  ) THEN
    CREATE POLICY "Authenticated can view delivery_invoice_status_history"
      ON public.delivery_invoice_status_history
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END$$;

-- 6) Trigger to normalize delivery_invoices rows
CREATE OR REPLACE FUNCTION public.normalize_delivery_invoice_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Normalize status to DRAFT/SENT/RECEIVED (simple heuristics with Arabic/English)
  IF COALESCE(TRIM(NEW.status), '') = '' THEN
    NEW.status_normalized := COALESCE(NEW.status_normalized, 'SENT');
  ELSE
    IF NEW.status ~* 'تم\s*الاستلام|استلم|received' THEN
      NEW.status_normalized := 'RECEIVED';
    ELSIF NEW.status ~* 'مسودة|draft' THEN
      NEW.status_normalized := 'DRAFT';
    ELSE
      NEW.status_normalized := 'SENT';
    END IF;
  END IF;

  -- Keep received_flag consistent (true if normalized is RECEIVED or boolean received is true)
  NEW.received_flag := COALESCE(NEW.received_flag, false) OR (NEW.status_normalized = 'RECEIVED') OR COALESCE(NEW.received, false);

  -- Ensure base columns follow when we know it's received
  IF NEW.received_flag = true AND COALESCE(NEW.received, false) = false THEN
    NEW.received := true;
    IF NEW.received_at IS NULL THEN
      NEW.received_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_delivery_invoice_row ON public.delivery_invoices;
CREATE TRIGGER trg_normalize_delivery_invoice_row
BEFORE INSERT OR UPDATE ON public.delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION public.normalize_delivery_invoice_row();

-- 7) Status change logging trigger
CREATE OR REPLACE FUNCTION public.log_delivery_invoice_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.status IS DISTINCT FROM OLD.status)
       OR (NEW.status_normalized IS DISTINCT FROM OLD.status_normalized)
       OR (NEW.received_flag IS DISTINCT FROM OLD.received_flag) THEN
      INSERT INTO public.delivery_invoice_status_history (
        invoice_id, old_status, new_status, old_status_normalized, new_status_normalized, changed_at
      ) VALUES (
        NEW.id, OLD.status, NEW.status, OLD.status_normalized, NEW.status_normalized, now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_delivery_invoice_status_change ON public.delivery_invoices;
CREATE TRIGGER trg_log_delivery_invoice_status_change
AFTER UPDATE ON public.delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION public.log_delivery_invoice_status_change();

-- 8) View that applies the dual-condition for "invoice received via invoice"
CREATE OR REPLACE VIEW public.orders_invoice_receipt_v AS
SELECT 
  o.id AS order_id,
  o.order_number,
  o.tracking_number,
  o.delivery_partner_order_id,
  dio.invoice_id,
  di.external_id AS invoice_external_id,
  di.received_flag,
  di.received_at,
  di.partner
FROM public.orders o
JOIN public.delivery_invoice_orders dio
  ON dio.order_id = o.id
   OR (o.delivery_partner_order_id IS NOT NULL AND dio.external_order_id = o.delivery_partner_order_id::text)
JOIN public.delivery_invoices di
  ON di.id = dio.invoice_id
WHERE di.received_flag = true;
