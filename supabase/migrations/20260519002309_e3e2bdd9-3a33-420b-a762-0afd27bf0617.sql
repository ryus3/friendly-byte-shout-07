-- ✅ تحسين link_invoice_orders_to_orders:
--   إضافة Phase 1.5 آمنة جداً: مطابقة عبر orders.delivery_partner_invoice_id = di.external_id
--   عندما يكون لدينا طلب محلي يحمل رقم نفس الفاتورة بالضبط (مرتبط أثناء استلام الفاتورة)
--   ولا يوجد لـ delivery_invoice_orders.row صف مطابق بمعرف قطعي. هذا يصلح الفواتير المستلمة
--   مثل 3319023 حيث الطلبات المحلية تشير للفاتورة لكن جدول الربط فارغ تقريباً.

CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
 RETURNS TABLE(fixed_count integer, linked_count integer, receipt_propagated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_linked_count INTEGER := 0;
  v_phase15_count INTEGER := 0;
  v_phase2_count INTEGER := 0;
  v_receipt_count INTEGER := 0;
BEGIN
  -- Phase 1: STRICT matching by definitive delivery IDs (tracking/qr/partner_order_id).
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
      SELECT 1 FROM public.delivery_invoice_orders od
      WHERE od.order_id = o.id AND od.id <> dio.id
    );
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  -- Phase 1.5: SAFE matching via local orders whose delivery_partner_invoice_id already points
  --   to this exact invoice. We try strict ID re-match across the invoice rows by phone+price.
  --   Only assigns dio.order_id when a single unique candidate is identified.
  WITH unmatched AS (
    SELECT dio.id AS dio_id,
           di.id AS inv_id,
           di.external_id AS inv_external_id,
           di.partner,
           right(regexp_replace(coalesce(dio.raw->>'client_mobile',''),'\D','','g'),10) AS api_phone,
           coalesce(NULLIF(dio.raw->>'price','')::numeric, dio.amount, 0) AS api_price
    FROM public.delivery_invoice_orders dio
    JOIN public.delivery_invoices di ON di.id = dio.invoice_id
    WHERE dio.order_id IS NULL
  ),
  pool AS (
    SELECT o.id AS order_id, o.customer_phone, o.final_amount, o.delivery_partner_invoice_id, o.delivery_partner
    FROM public.orders o
    WHERE o.delivery_partner_invoice_id IS NOT NULL
      AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
      AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14')
      AND NOT EXISTS (
        SELECT 1 FROM public.delivery_invoice_orders od WHERE od.order_id = o.id
      )
  ),
  candidates AS (
    SELECT u.dio_id, p.order_id,
           row_number() OVER (PARTITION BY u.dio_id ORDER BY abs(coalesce(p.final_amount,0) - u.api_price) ASC) AS rn,
           count(*) OVER (PARTITION BY u.dio_id) AS cnt
    FROM unmatched u
    JOIN pool p
      ON p.delivery_partner_invoice_id = u.inv_external_id
     AND COALESCE(p.delivery_partner, u.partner) = u.partner
     AND right(regexp_replace(coalesce(p.customer_phone,''),'\D','','g'),10) = u.api_phone
     AND abs(coalesce(p.final_amount,0) - u.api_price) <= 5000
  ),
  unique_matches AS (
    SELECT dio_id, order_id FROM candidates WHERE cnt = 1 AND rn = 1
  )
  UPDATE public.delivery_invoice_orders dio
  SET order_id = um.order_id, updated_at = now()
  FROM unique_matches um
  WHERE dio.id = um.dio_id AND dio.order_id IS NULL;
  GET DIAGNOSTICS v_phase15_count = ROW_COUNT;
  v_linked_count := v_linked_count + v_phase15_count;

  -- Phase 2: SAFE fallback by phone + price when ID match failed (original behavior).
  WITH unmatched AS (
    SELECT dio.id AS dio_id,
           di.id AS inv_id,
           di.partner,
           right(regexp_replace(coalesce(dio.raw->>'client_mobile',''),'\D','','g'),10) AS api_phone,
           coalesce(NULLIF(dio.raw->>'price','')::numeric, dio.amount, 0) AS api_price,
           coalesce(di.received_at, di.issued_at, di.updated_at, now()) AS inv_date
    FROM public.delivery_invoice_orders dio
    JOIN public.delivery_invoices di ON di.id = dio.invoice_id
    WHERE dio.order_id IS NULL
      AND NULLIF(trim(dio.raw->>'client_mobile'), '') IS NOT NULL
  ),
  candidates AS (
    SELECT u.dio_id, u.inv_id, o.id AS order_id,
           row_number() OVER (PARTITION BY u.dio_id ORDER BY abs(coalesce(o.final_amount,0) - u.api_price) ASC, o.created_at DESC) AS rn,
           count(*) OVER (PARTITION BY u.dio_id) AS cnt
    FROM unmatched u
    JOIN public.orders o
      ON COALESCE(o.delivery_partner, u.partner) = u.partner
     AND right(regexp_replace(coalesce(o.customer_phone,''),'\D','','g'),10) = u.api_phone
     AND abs(coalesce(o.final_amount,0) - u.api_price) <= 10000
     AND o.created_at >= u.inv_date - interval '120 days'
     AND o.created_at <= u.inv_date + interval '14 days'
     AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
     AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14')
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_invoice_orders od WHERE od.order_id = o.id
     )
  ),
  unique_matches AS (
    SELECT dio_id, order_id FROM candidates WHERE cnt = 1 AND rn = 1
  )
  UPDATE public.delivery_invoice_orders dio
  SET order_id = um.order_id, updated_at = now()
  FROM unique_matches um
  WHERE dio.id = um.dio_id AND dio.order_id IS NULL;
  GET DIAGNOSTICS v_phase2_count = ROW_COUNT;
  v_linked_count := v_linked_count + v_phase2_count;

  -- Phase 3: propagate delivery_partner_invoice_id on linked orders
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id,
      delivery_partner_invoice_date = COALESCE(di.received_at, di.issued_at, di.updated_at),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
    AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14');
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  -- Phase 4: propagate receipt_received from received invoices
  UPDATE public.orders o
  SET receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, di.issued_at, now()),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND di.received = true
    AND (o.receipt_received IS DISTINCT FROM true)
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled');
  GET DIAGNOSTICS v_receipt_count = ROW_COUNT;

  RETURN QUERY SELECT v_fixed_count, v_linked_count, v_receipt_count;
END;
$function$;

-- شغّل الدالة مباشرة لإصلاح الفواتير الحالية
SELECT * FROM public.link_invoice_orders_to_orders();