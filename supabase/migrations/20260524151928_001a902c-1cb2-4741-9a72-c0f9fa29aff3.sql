-- Root-cause fix for invoice 3406747 and any incomplete invoice:
-- The trigger trg_auto_link_order_to_invoice on public.orders inserts into
-- public.delivery_invoice_orders with ON CONFLICT. When we upsert N rows into
-- delivery_invoice_orders, our BEFORE trigger auto_link_dio_on_change updates
-- public.orders, which fires this trigger, which then INSERTs back into
-- delivery_invoice_orders ON CONFLICT — touching rows from our outer command
-- and raising:
--   "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- Removing it eliminates the cascade. Linking remains handled by:
--  * auto_link_dio_on_change (BEFORE trigger on delivery_invoice_orders)
--  * public.link_invoice_orders_to_orders() RPC (called after each sync)
DROP TRIGGER IF EXISTS trg_auto_link_order_to_invoice ON public.orders;
DROP FUNCTION IF EXISTS public.auto_link_order_to_invoice();