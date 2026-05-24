-- Remove the redundant linker trigger to prevent double BEFORE handling on delivery_invoice_orders.
-- Keep trg_auto_link_dio (auto_link_dio_on_change) which is the more comprehensive linker
-- (matches via external_order_id, raw.id, raw.qr_id, raw.tracking_number, raw.delivery_partner_order_id
--  and respects partner+account isolation and exclusion of returned/rejected statuses).
DROP TRIGGER IF EXISTS trg_auto_link_dio_to_order ON public.delivery_invoice_orders;

-- Drop the now-orphan function (no longer referenced by any trigger)
DROP FUNCTION IF EXISTS public.auto_link_dio_to_order();