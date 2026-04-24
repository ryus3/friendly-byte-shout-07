-- Fix link_invoice_orders_to_orders: target table 'dio' cannot be referenced
-- inside FROM-clause JOIN's ON condition. Move dio refs to WHERE clause.
CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
 RETURNS TABLE(fixed_count integer, linked_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_linked_count INTEGER := 0;
BEGIN
  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND dio.order_id IS NOT NULL
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  -- FIX: target table "dio" cannot appear in JOIN ON; reference moved to WHERE
  UPDATE public.delivery_invoice_orders dio
  SET order_id = o.id
  FROM public.delivery_invoices di,
       public.orders o
  WHERE dio.invoice_id = di.id
    AND dio.external_order_id IS NOT NULL
    AND (o.tracking_number = dio.external_order_id
         OR o.delivery_partner_order_id = dio.external_order_id)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND (dio.order_id IS NULL OR dio.order_id <> o.id)
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  UPDATE public.orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id <> di.external_id)
    AND COALESCE(o.delivery_partner, di.partner) = di.partner
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND COALESCE(o.delivery_status, '') NOT IN ('17', '12', '13', '14');

  RETURN QUERY SELECT v_fixed_count, v_linked_count;
END;
$function$;

-- Unique index for MODON cities batch upsert (no duplicates exist)
CREATE UNIQUE INDEX IF NOT EXISTS cities_master_name_key
  ON public.cities_master (name);