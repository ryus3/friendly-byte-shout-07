-- 1) Cleanup: unlink rows where dio.raw->>'id' (or external_order_id) exists but doesn't match
--    any of the order's IDs (tracking_number / delivery_partner_order_id / qr_id).
--    This removes the bad phone+amount fallback links like invoice 3319023 -> order 141392531.
UPDATE public.delivery_invoice_orders dio
SET order_id = NULL, updated_at = now()
FROM public.orders o
WHERE dio.order_id = o.id
  AND COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id') IS NOT NULL
  AND o.tracking_number IS DISTINCT FROM COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
  AND o.delivery_partner_order_id IS DISTINCT FROM COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
  AND o.qr_id IS DISTINCT FROM COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id');

-- 2) Replace link function with stricter logic
CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
RETURNS TABLE(fixed_count integer, linked_count integer, receipt_propagated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_linked_count INTEGER := 0;
  v_receipt_count INTEGER := 0;
BEGIN
  -- Phase 1: STRICT matching by definitive delivery IDs only.
  -- The dio external_order_id (or raw.id / raw.qr_id) must equal one of the order's
  -- delivery identifiers. NEVER fallback to phone+amount when a definitive ID exists.
  UPDATE public.delivery_invoice_orders dio
  SET order_id = o.id, updated_at = now()
  FROM public.delivery_invoices di,
       public.orders o
  WHERE dio.invoice_id = di.id
    AND (
      o.tracking_number = COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
      OR o.delivery_partner_order_id = COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
      OR o.qr_id = COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id')
    )
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND (dio.order_id IS NULL OR dio.order_id <> o.id)
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14')
    AND NOT EXISTS (
      SELECT 1
      FROM public.delivery_invoice_orders other_dio
      WHERE other_dio.order_id = o.id
        AND other_dio.invoice_id = dio.invoice_id
        AND other_dio.id <> dio.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.delivery_invoice_orders other_dio
      WHERE other_dio.order_id = o.id
        AND other_dio.invoice_id <> dio.invoice_id
    );
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  -- Phase 2: Fallback by phone+amount ONLY when dio has no definitive ID at all
  UPDATE public.delivery_invoice_orders dio
  SET order_id = o.id, updated_at = now()
  FROM public.delivery_invoices di,
       public.orders o
  WHERE dio.invoice_id = di.id
    AND dio.order_id IS NULL
    AND COALESCE(NULLIF(dio.external_order_id,''), dio.raw->>'id', dio.raw->>'qr_id') IS NULL
    AND NULLIF(trim(dio.raw->>'client_mobile'), '') IS NOT NULL
    AND right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 10)
      = right(regexp_replace(coalesce(dio.raw->>'client_mobile', ''), '\D', '', 'g'), 10)
    AND abs(coalesce(o.final_amount, 0) - coalesce(NULLIF(dio.raw->>'price', '')::numeric, 0)) <= 5000
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.created_at >= coalesce(di.issued_at, di.created_at) - interval '120 days'
    AND o.created_at <= coalesce(di.received_at, di.issued_at, di.updated_at, now()) + interval '14 days'
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14')
    AND NOT EXISTS (
      SELECT 1 FROM public.delivery_invoice_orders other_dio
      WHERE other_dio.order_id = o.id
    );

  -- Phase 3: propagate delivery_partner_invoice_id on linked orders
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id,
      delivery_partner_invoice_date = COALESCE(di.received_at, di.issued_at, di.updated_at),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  -- Phase 4: propagate receipt_received from received invoices to their linked orders
  UPDATE public.orders o
  SET receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, di.issued_at, now()),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND di.received = true
    AND (o.receipt_received IS DISTINCT FROM true)
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled');
  GET DIAGNOSTICS v_receipt_count = ROW_COUNT;

  RETURN QUERY SELECT v_fixed_count, v_linked_count, v_receipt_count;
END;
$function$;

-- 3) Run linker once to apply correct links
SELECT * FROM public.link_invoice_orders_to_orders();