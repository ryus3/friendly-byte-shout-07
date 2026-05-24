-- Reset orders_last_synced_at for invoices whose cached order rows are fewer than orders_count
UPDATE public.delivery_invoices di
SET orders_last_synced_at = NULL
WHERE COALESCE(di.orders_count, 0) > (
  SELECT count(*) FROM public.delivery_invoice_orders dio WHERE dio.invoice_id = di.id
);

-- Force re-link after edge function/UI updates
SELECT * FROM public.link_invoice_orders_to_orders();