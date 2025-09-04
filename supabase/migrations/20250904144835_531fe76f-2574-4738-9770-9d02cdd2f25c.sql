-- Enhance sync_recent_received_invoices to also set status to completed for manager orders currently delivered
CREATE OR REPLACE FUNCTION public.sync_recent_received_invoices()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  updated_orders_count integer := 0;
  invoice_record RECORD;
  current_count integer;
BEGIN
  FOR invoice_record IN 
    SELECT di.id, di.external_id, di.received_at
    FROM public.delivery_invoices di
    WHERE di.received = true
      AND di.received_at >= now() - interval '30 days'
      AND di.partner = 'alwaseet'
    ORDER BY di.received_at DESC
  LOOP
    -- Update orders linked via delivery_invoice_orders
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      -- Auto-complete manager orders that were delivered
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid AND o.status = 'delivered' THEN 'completed'
        ELSE o.status
      END,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = invoice_record.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;

    GET DIAGNOSTICS current_count = ROW_COUNT;
    updated_orders_count := updated_orders_count + current_count;

    -- Also update orders linked by delivery_partner_order_id
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid AND o.status = 'delivered' THEN 'completed'
        ELSE o.status
      END,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = invoice_record.id
      )
      AND o.receipt_received = false
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet';

    GET DIAGNOSTICS current_count = ROW_COUNT;
    updated_orders_count := updated_orders_count + current_count;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_orders_count,
    'message', 'Updated ' || updated_orders_count || ' orders from recent received invoices'
  );
END;
$function$;