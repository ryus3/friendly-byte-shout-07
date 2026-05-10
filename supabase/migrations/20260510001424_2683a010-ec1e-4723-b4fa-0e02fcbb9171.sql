-- Drop duplicate unique indexes on delivery_invoice_orders
DROP INDEX IF EXISTS public.uq_dio_invoice_external;
DROP INDEX IF EXISTS public.ux_delivery_invoice_orders_invoice_external;