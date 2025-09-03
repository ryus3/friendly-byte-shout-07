-- Fix the trigger to clear receipt_received_at when receipt_received is set to false
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- When invoice receipt toggles true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- Stamp metadata if missing
    IF NEW.receipt_received_at IS NULL THEN
      NEW.receipt_received_at := now();
    END IF;
    IF NEW.receipt_received_by IS NULL THEN
      NEW.receipt_received_by := COALESCE(auth.uid(), NEW.created_by);
    END IF;

    -- If the order belongs to the manager/system owner, mark as completed
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      -- Only move forward from delivered to completed
      IF NEW.status = 'delivered' THEN
        NEW.status := 'completed';
      END IF;
    END IF;
  END IF;

  -- When invoice receipt is set to false, clear the timestamp
  IF NEW.receipt_received = false AND COALESCE(OLD.receipt_received, false) = true THEN
    NEW.receipt_received_at := NULL;
    NEW.receipt_received_by := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the propagate_invoice_received_to_orders function to handle the new sync
CREATE OR REPLACE FUNCTION public.propagate_invoice_received_to_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- When a delivery invoice is marked as received
  IF NEW.received = true AND COALESCE(OLD.received, false) = false THEN
    -- Update all linked orders to mark receipt as received
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      delivery_partner_invoice_id = NEW.external_id::text,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;

    -- Also update orders linked by delivery_partner_order_id if they exist
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      delivery_partner_invoice_id = NEW.external_id::text,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
      )
      AND o.receipt_received = false
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet';
  END IF;

  -- When a delivery invoice is marked as not received
  IF NEW.received = false AND COALESCE(OLD.received, false) = true THEN
    -- Update all linked orders to mark receipt as not received
    UPDATE public.orders o
    SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL,
      delivery_partner_invoice_id = NULL,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id;

    -- Also update orders linked by delivery_partner_order_id
    UPDATE public.orders o
    SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL,
      delivery_partner_invoice_id = NULL,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
      )
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet';
  END IF;

  RETURN NEW;
END;
$function$;

-- Create a function to sync AlWaseet invoice data
CREATE OR REPLACE FUNCTION public.sync_alwaseet_invoice_data(
  p_invoice_data jsonb,
  p_orders_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  invoice_id uuid;
  order_data jsonb;
  local_order_id uuid;
  linked_orders_count integer := 0;
  total_orders_count integer := 0;
  invoice_received boolean;
BEGIN
  -- Check if invoice status indicates it's received
  invoice_received := (p_invoice_data->>'status') = 'تم الاستلام من قبل التاجر';
  
  -- Insert or update the delivery invoice
  INSERT INTO public.delivery_invoices (
    external_id,
    partner,
    amount,
    orders_count,
    issued_at,
    received,
    received_at,
    status,
    raw
  ) VALUES (
    p_invoice_data->>'id',
    'alwaseet',
    COALESCE((p_invoice_data->>'merchant_price')::numeric, 0),
    COALESCE((p_invoice_data->>'delivered_orders_count')::integer, 0),
    COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()),
    invoice_received,
    CASE WHEN invoice_received THEN COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()) ELSE NULL END,
    p_invoice_data->>'status',
    p_invoice_data
  )
  ON CONFLICT (external_id, partner) DO UPDATE SET
    amount = EXCLUDED.amount,
    orders_count = EXCLUDED.orders_count,
    received = EXCLUDED.received,
    received_at = EXCLUDED.received_at,
    status = EXCLUDED.status,
    raw = EXCLUDED.raw,
    updated_at = now()
  RETURNING id INTO invoice_id;

  -- Process each order in the invoice
  FOR order_data IN SELECT * FROM jsonb_array_elements(p_orders_data)
  LOOP
    total_orders_count := total_orders_count + 1;
    
    -- Try to find the local order by delivery_partner_order_id first
    SELECT id INTO local_order_id
    FROM public.orders 
    WHERE delivery_partner_order_id = (order_data->>'id')::text
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    LIMIT 1;
    
    -- If not found, try by tracking_number
    IF local_order_id IS NULL THEN
      SELECT id INTO local_order_id
      FROM public.orders 
      WHERE tracking_number = (order_data->>'id')::text
      AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
      LIMIT 1;
    END IF;
    
    -- Insert or update the delivery invoice order
    INSERT INTO public.delivery_invoice_orders (
      invoice_id,
      order_id,
      external_order_id,
      raw
    ) VALUES (
      invoice_id,
      local_order_id,
      order_data->>'id',
      order_data
    )
    ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
      order_id = EXCLUDED.order_id,
      raw = EXCLUDED.raw,
      updated_at = now();
    
    IF local_order_id IS NOT NULL THEN
      linked_orders_count := linked_orders_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', invoice_id,
    'total_orders', total_orders_count,
    'linked_orders', linked_orders_count,
    'invoice_received', invoice_received
  );
END;
$function$;