-- 1) Disable the legacy duplicate notification trigger that was causing repeated
-- "order_status_changed" notifications on every sync, even when status didn't change.
-- The unified channel "alwaseet_status_change" (handled by sync-order-updates edge function)
-- already performs strict dedup at the database level.
DROP TRIGGER IF EXISTS trg_send_order_notifications ON public.orders;

-- 2) Expand link_invoice_orders_to_orders to match orders via:
--    - tracking_number
--    - delivery_partner_order_id
--    - qr_id
--    - delivery_invoice_orders.raw->>'id'
-- This fixes invoices like 3319023 where delivery_invoice_orders.external_order_id
-- corresponds to the alwaseet order id but local orders only have qr_id/tracking_number.
CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
RETURNS TABLE(fixed_count integer, linked_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_linked_count INTEGER := 0;
BEGIN
  -- Pre-pass: ensure delivery_partner_invoice_id is set for already-linked rows
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND dio.order_id IS NOT NULL
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  -- Main link pass: match dio rows to local orders using all available identifiers
  UPDATE public.delivery_invoice_orders dio
  SET order_id = o.id
  FROM public.delivery_invoices di,
       public.orders o
  WHERE dio.invoice_id = di.id
    AND dio.external_order_id IS NOT NULL
    AND (
      o.tracking_number = dio.external_order_id
      OR o.delivery_partner_order_id = dio.external_order_id
      OR o.qr_id = dio.external_order_id
      OR o.tracking_number = (dio.raw->>'id')
      OR o.delivery_partner_order_id = (dio.raw->>'id')
      OR o.qr_id = (dio.raw->>'id')
    )
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND (dio.order_id IS NULL OR dio.order_id <> o.id)
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  -- Post-pass: propagate the invoice external_id to the order
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');

  RETURN QUERY SELECT v_fixed_count, v_linked_count;
END;
$function$;

-- 3) Run it now to heal current data (covers invoice 3319023 and others).
SELECT * FROM public.link_invoice_orders_to_orders();