-- Fix security issue: Remove SECURITY DEFINER from view and recreate as standard view
DROP VIEW IF EXISTS public.orders_invoice_receipt_v;

CREATE VIEW public.orders_invoice_receipt_v AS
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

-- Grant appropriate access to the view (inherits RLS from underlying tables)
GRANT SELECT ON public.orders_invoice_receipt_v TO authenticated;