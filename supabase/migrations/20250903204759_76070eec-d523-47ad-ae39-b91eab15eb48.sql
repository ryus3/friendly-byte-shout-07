-- Ensure unique indexes exist for upserts used by sync_alwaseet_invoice_data
CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_invoices_external_partner
ON public.delivery_invoices (external_id, partner);

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_invoice_orders_invoice_external
ON public.delivery_invoice_orders (invoice_id, external_order_id);
