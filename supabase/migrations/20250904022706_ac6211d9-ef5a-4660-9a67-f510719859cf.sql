-- Fix the current order 98713588 immediately
UPDATE public.orders
SET 
  receipt_received = true,
  receipt_received_at = now(),
  receipt_received_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  delivery_partner_invoice_id = '1962564',
  status = 'completed',
  updated_at = now()
WHERE tracking_number = '98713588' 
  AND created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;

-- Add table to realtime publication for automatic updates
ALTER TABLE IF EXISTS public.delivery_invoices REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.delivery_invoice_orders REPLICA IDENTITY FULL;

-- Create an enhanced invoice sync function for automatic processing
CREATE OR REPLACE FUNCTION public.auto_sync_received_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  invoice_record RECORD;
  order_count INTEGER := 0;
BEGIN
  -- Process only recent received invoices from last 24 hours
  FOR invoice_record IN 
    SELECT di.id, di.external_id, di.received_at
    FROM public.delivery_invoices di
    WHERE di.received = true
    AND di.received_at >= now() - interval '24 hours'
    AND di.partner = 'alwaseet'
    AND di.last_synced_at < di.received_at OR di.last_synced_at IS NULL
  LOOP
    -- Update linked orders for this invoice
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
        THEN 'completed' 
        ELSE o.status 
      END,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = invoice_record.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;

    GET DIAGNOSTICS order_count = ROW_COUNT;
    
    -- Also update orders linked by delivery_partner_order_id
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
        THEN 'completed' 
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

    -- Mark invoice as synced
    UPDATE public.delivery_invoices
    SET last_synced_at = now()
    WHERE id = invoice_record.id;
    
    RAISE NOTICE 'Auto-synced invoice %: updated % orders', invoice_record.external_id, order_count;
  END LOOP;
END;
$function$;

-- Create trigger to auto-sync when invoices are marked as received
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- If invoice is newly marked as received, trigger auto-sync
  IF NEW.received = true AND COALESCE(OLD.received, false) = false THEN
    PERFORM public.auto_sync_received_invoices();
  END IF;
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_sync_on_invoice_received ON public.delivery_invoices;
CREATE TRIGGER auto_sync_on_invoice_received
  AFTER UPDATE ON public.delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_invoice();