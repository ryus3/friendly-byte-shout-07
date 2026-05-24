CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
RETURNS TABLE(fixed_count integer, linked_count integer, receipt_propagated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_linked_count INTEGER := 0;
  v_phase_strict_count INTEGER := 0;
  v_phase_invoice_id_only INTEGER := 0;
  v_receipt_count INTEGER := 0;
BEGIN
  -- Phase 1: ربط عرض محلي صارم عبر معرفات شركة التوصيل فقط.
  -- ملاحظة: نسمح بربط المرتجعات هنا للعرض داخل الفاتورة، لكن لا ننشر استلام/مستحقات مالياً عليها لاحقاً.
  WITH unmatched AS (
    SELECT dio.id AS dio_id, di.partner, di.account_username,
           ARRAY_REMOVE(ARRAY[
             NULLIF(trim(dio.external_order_id), ''),
             NULLIF(trim(dio.raw->>'id'), ''),
             NULLIF(trim(dio.raw->>'qr_id'), ''),
             NULLIF(trim(dio.raw->>'tracking_number'), ''),
             NULLIF(trim(dio.raw->>'delivery_partner_order_id'), '')
           ], NULL) AS ids
    FROM public.delivery_invoice_orders dio
    JOIN public.delivery_invoices di ON di.id = dio.invoice_id
    WHERE dio.order_id IS NULL
  ), candidates AS (
    SELECT u.dio_id, o.id AS order_id,
           row_number() OVER (PARTITION BY u.dio_id ORDER BY o.created_at DESC) AS rn_dio,
           count(*) OVER (PARTITION BY u.dio_id) AS cnt_dio,
           count(*) OVER (PARTITION BY o.id) AS cnt_order
    FROM unmatched u
    JOIN public.orders o
      ON COALESCE(o.delivery_partner, u.partner) = u.partner
     AND (u.account_username IS NULL OR o.delivery_account_used IS NULL
          OR lower(trim(o.delivery_account_used)) = lower(trim(u.account_username)))
     AND (
       o.tracking_number = ANY(u.ids)
       OR o.delivery_partner_order_id = ANY(u.ids)
       OR o.qr_id = ANY(u.ids)
     )
     AND o.status NOT IN ('rejected','cancelled')
     AND COALESCE(o.delivery_status,'') NOT IN ('12','13','14')
     AND NOT EXISTS (SELECT 1 FROM public.delivery_invoice_orders od WHERE od.order_id = o.id AND od.id <> u.dio_id)
  ), unique_matches AS (
    SELECT dio_id, order_id FROM candidates WHERE rn_dio = 1 AND cnt_dio = 1 AND cnt_order = 1
  )
  UPDATE public.delivery_invoice_orders dio
  SET order_id = um.order_id, updated_at = now()
  FROM unique_matches um WHERE dio.id = um.dio_id AND dio.order_id IS NULL;
  GET DIAGNOSTICS v_phase_strict_count = ROW_COUNT;
  v_linked_count := v_linked_count + v_phase_strict_count;

  -- Phase 1.5: ربط عرض محلي عبر مرجع الفاتورة عندما يكون موجوداً مسبقاً على الطلب.
  WITH unmatched AS (
    SELECT dio.id AS dio_id, di.external_id AS invoice_external_id, di.partner, di.account_username
    FROM public.delivery_invoice_orders dio
    JOIN public.delivery_invoices di ON di.id = dio.invoice_id
    WHERE dio.order_id IS NULL
  ), candidates AS (
    SELECT u.dio_id, o.id AS order_id,
           row_number() OVER (PARTITION BY u.dio_id ORDER BY o.created_at DESC) AS rn_dio,
           count(*) OVER (PARTITION BY u.dio_id) AS cnt_dio,
           count(*) OVER (PARTITION BY o.id) AS cnt_order
    FROM unmatched u
    JOIN public.orders o
      ON o.delivery_partner_invoice_id = u.invoice_external_id
     AND COALESCE(o.delivery_partner, u.partner) = u.partner
     AND (u.account_username IS NULL OR o.delivery_account_used IS NULL
          OR lower(trim(o.delivery_account_used)) = lower(trim(u.account_username)))
     AND o.status NOT IN ('rejected','cancelled')
     AND COALESCE(o.delivery_status,'') NOT IN ('12','13','14')
     AND NOT EXISTS (SELECT 1 FROM public.delivery_invoice_orders od WHERE od.order_id = o.id AND od.id <> u.dio_id)
  ), unique_matches AS (
    SELECT dio_id, order_id FROM candidates WHERE rn_dio = 1 AND cnt_dio = 1 AND cnt_order = 1
  )
  UPDATE public.delivery_invoice_orders dio
  SET order_id = um.order_id, updated_at = now()
  FROM unique_matches um WHERE dio.id = um.dio_id AND dio.order_id IS NULL;
  GET DIAGNOSTICS v_phase_invoice_id_only = ROW_COUNT;
  v_linked_count := v_linked_count + v_phase_invoice_id_only;

  -- Phase 3: نشر مرجع الفاتورة فقط للطلبات المؤهلة مالياً، وليس للمرتجعات أو الملغاة.
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id,
      delivery_partner_invoice_date = COALESCE(di.received_at, di.issued_at, di.updated_at),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
    AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14');
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  -- Phase 4: نشر استلام الفاتورة فقط للطلبات المؤهلة وغير المرتجعة.
  UPDATE public.orders o
  SET receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, di.issued_at, now()),
      updated_at = now()
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND di.received = true
    AND (o.receipt_received IS DISTINCT FROM true)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
    AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14');
  GET DIAGNOSTICS v_receipt_count = ROW_COUNT;

  RETURN QUERY SELECT v_fixed_count, v_linked_count, v_receipt_count;
END;
$function$;

SELECT * FROM public.link_invoice_orders_to_orders();