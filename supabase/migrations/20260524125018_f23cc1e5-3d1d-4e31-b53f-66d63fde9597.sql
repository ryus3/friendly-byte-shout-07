-- Reset orders_last_synced_at on invoices whose cached order rows < expected orders_count
-- so the next smart-invoice-sync pass re-fetches them in full.
UPDATE public.delivery_invoices di
SET orders_last_synced_at = NULL
WHERE coalesce(di.orders_count, 0) > 0
  AND coalesce(di.orders_count, 0) > (
    SELECT count(*) FROM public.delivery_invoice_orders dio WHERE dio.invoice_id = di.id
  );

-- Re-run strict linking to attach any orders whose local rows already match by tracking/qr/partner id
SELECT * FROM public.link_invoice_orders_to_orders();