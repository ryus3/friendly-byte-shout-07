
-- 1) Keep only the latest 2 AlWaseet invoices; delete the rest and their child rows
-- We consider "latest" by issued_at, then last_api_updated_at, then created_at
WITH ranked AS (
  SELECT id
  FROM public.delivery_invoices
  WHERE LOWER(partner) = 'alwaseet'
  ORDER BY COALESCE(issued_at, last_api_updated_at, created_at) DESC, id DESC
  LIMIT 2
),
to_delete AS (
  SELECT di.id
  FROM public.delivery_invoices di
  WHERE LOWER(di.partner) = 'alwaseet'
    AND di.id NOT IN (SELECT id FROM ranked)
)
DELETE FROM public.delivery_invoice_orders dio
WHERE dio.invoice_id IN (SELECT id FROM to_delete);

WITH ranked AS (
  SELECT id
  FROM public.delivery_invoices
  WHERE LOWER(partner) = 'alwaseet'
  ORDER BY COALESCE(issued_at, last_api_updated_at, created_at) DESC, id DESC
  LIMIT 2
),
to_delete AS (
  SELECT di.id
  FROM public.delivery_invoices di
  WHERE LOWER(di.partner) = 'alwaseet'
    AND di.id NOT IN (SELECT id FROM ranked)
)
DELETE FROM public.delivery_invoices di
WHERE di.id IN (SELECT id FROM to_delete);

-- 2) Helper function to prune/retain only latest N invoices for a partner (optional future use)
CREATE OR REPLACE FUNCTION public.prune_delivery_invoices_keep_latest(p_keep integer DEFAULT 2, p_partner text DEFAULT 'alwaseet')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  -- Delete children first
  WITH ranked AS (
    SELECT id,
           row_number() OVER (ORDER BY COALESCE(issued_at, last_api_updated_at, created_at) DESC, id DESC) AS rn
    FROM public.delivery_invoices
    WHERE LOWER(partner) = LOWER(p_partner)
  ),
  to_delete AS (SELECT id FROM ranked WHERE rn > p_keep)
  DELETE FROM public.delivery_invoice_orders dio
  USING to_delete td
  WHERE dio.invoice_id = td.id;

  -- Delete parent invoices
  WITH ranked AS (
    SELECT id,
           row_number() OVER (ORDER BY COALESCE(issued_at, last_api_updated_at, created_at) DESC, id DESC) AS rn
    FROM public.delivery_invoices
    WHERE LOWER(partner) = LOWER(p_partner)
  ),
  to_delete AS (SELECT id FROM ranked WHERE rn > p_keep)
  DELETE FROM public.delivery_invoices di
  USING to_delete td
  WHERE di.id = td.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN COALESCE(v_deleted, 0);
END;
$function$;

-- 3) Auto-link invoice orders to local orders by external_order_id (AlWaseet order id) or tracking_number
CREATE OR REPLACE FUNCTION public.try_link_delivery_invoice_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_invoice_partner text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- Only proceed for AlWaseet
  SELECT LOWER(COALESCE(partner,'')) INTO v_invoice_partner
  FROM public.delivery_invoices
  WHERE id = NEW.invoice_id;

  IF v_invoice_partner <> 'alwaseet' THEN
    RETURN NEW;
  END IF;

  -- If already linked, skip
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try by delivery_partner_order_id
  IF NEW.external_order_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE LOWER(COALESCE(delivery_partner,'')) = 'alwaseet'
      AND (delivery_partner_order_id = NEW.external_order_id OR tracking_number = NEW.external_order_id)
      AND (created_by = v_current_user_id OR is_admin_or_deputy())
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_order_id IS NOT NULL THEN
    NEW.order_id := v_order_id;
  END IF;

  RETURN NEW;
END;
$function$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_try_link_delivery_invoice_order'
  ) THEN
    CREATE TRIGGER trg_try_link_delivery_invoice_order
    BEFORE INSERT OR UPDATE OF external_order_id, order_id
    ON public.delivery_invoice_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.try_link_delivery_invoice_order();
  END IF;
END
$do$;

-- 4) If invoice is received, mark linked orders as receipt_received automatically
CREATE OR REPLACE FUNCTION public.mark_order_receipt_if_invoice_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_received boolean;
  v_external_id text;
  v_partner text;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT received, external_id, LOWER(COALESCE(partner,'')) INTO v_received, v_external_id, v_partner
  FROM public.delivery_invoices
  WHERE id = NEW.invoice_id;

  IF v_partner = 'alwaseet' AND COALESCE(v_received, false) = true THEN
    UPDATE public.orders o
    SET receipt_received = true,
        receipt_received_at = COALESCE(o.receipt_received_at, now()),
        receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
        delivery_partner_invoice_id = v_external_id,
        updated_at = now()
    WHERE o.id = NEW.order_id
      AND o.receipt_received = false;
  END IF;

  RETURN NEW;
END;
$function$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mark_order_receipt_if_invoice_received'
  ) THEN
    CREATE TRIGGER trg_mark_order_receipt_if_invoice_received
    AFTER INSERT OR UPDATE OF order_id
    ON public.delivery_invoice_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.mark_order_receipt_if_invoice_received();
  END IF;
END
$do$;

-- 5) Ensure delivery_invoices triggers exist (normalize, log history, propagate invoice received to orders)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_normalize_delivery_invoice_row'
  ) THEN
    CREATE TRIGGER trg_normalize_delivery_invoice_row
    BEFORE INSERT OR UPDATE ON public.delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_delivery_invoice_row();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_delivery_invoice_status_change'
  ) THEN
    CREATE TRIGGER trg_log_delivery_invoice_status_change
    AFTER UPDATE ON public.delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.log_delivery_invoice_status_change();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_propagate_invoice_received_to_orders'
  ) THEN
    CREATE TRIGGER trg_propagate_invoice_received_to_orders
    AFTER UPDATE OF received ON public.delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.propagate_invoice_received_to_orders();
  END IF;
END
$do$;

-- 6) Ensure profits trigger exists (complete order when settled)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_complete_order_when_profit_settled'
  ) THEN
    CREATE TRIGGER trg_complete_order_when_profit_settled
    AFTER INSERT OR UPDATE OF status ON public.profits
    FOR EACH ROW
    EXECUTE FUNCTION public.complete_order_when_profit_settled();
  END IF;
END
$do$;

-- 7) Backfill safety: for currently kept received invoices, mark linked orders as receipt_received (in case they were linked after receipt)
UPDATE public.orders o
SET receipt_received = true,
    receipt_received_at = COALESCE(o.receipt_received_at, now()),
    receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
    delivery_partner_invoice_id = di.external_id,
    updated_at = now()
FROM public.delivery_invoice_orders dio
JOIN public.delivery_invoices di ON di.id = dio.invoice_id
JOIN (
  SELECT id
  FROM public.delivery_invoices
  WHERE LOWER(partner) = 'alwaseet'
  ORDER BY COALESCE(issued_at, last_api_updated_at, created_at) DESC, id DESC
  LIMIT 2
) keep ON keep.id = di.id
WHERE dio.order_id = o.id
  AND LOWER(COALESCE(di.partner,'')) = 'alwaseet'
  AND COALESCE(di.received, false) = true
  AND o.receipt_received = false;

-- 8) Helpful indexes for fast linking
CREATE INDEX IF NOT EXISTS idx_orders_partner_partner_order ON public.orders (delivery_partner, delivery_partner_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (tracking_number);
