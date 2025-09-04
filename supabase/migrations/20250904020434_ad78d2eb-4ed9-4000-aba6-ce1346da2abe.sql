-- Fix sync_alwaseet_invoice_data function to properly match orders by qr_id
CREATE OR REPLACE FUNCTION public.sync_alwaseet_invoice_data(p_invoice_data jsonb, p_orders_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invoice_id uuid;
  order_data jsonb;
  local_order_id uuid;
  linked_orders_count integer := 0;
  total_orders_count integer := 0;
  invoice_received boolean;
  v_current_user_id uuid := auth.uid();
  order_qr_id text;
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
    raw,
    owner_user_id
  ) VALUES (
    p_invoice_data->>'id',
    'alwaseet',
    COALESCE((p_invoice_data->>'merchant_price')::numeric, 0),
    COALESCE((p_invoice_data->>'delivered_orders_count')::integer, 0),
    COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()),
    invoice_received,
    CASE WHEN invoice_received THEN COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()) ELSE NULL END,
    p_invoice_data->>'status',
    p_invoice_data,
    v_current_user_id
  )
  ON CONFLICT (external_id, partner) DO UPDATE SET
    amount = EXCLUDED.amount,
    orders_count = EXCLUDED.orders_count,
    received = EXCLUDED.received,
    received_at = EXCLUDED.received_at,
    status = EXCLUDED.status,
    raw = EXCLUDED.raw,
    owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
    updated_at = now()
  RETURNING id INTO v_invoice_id;

  RAISE NOTICE 'Syncing invoice % with % orders', p_invoice_data->>'id', jsonb_array_length(p_orders_data);

  -- Process each order in the invoice
  FOR order_data IN SELECT * FROM jsonb_array_elements(p_orders_data)
  LOOP
    total_orders_count := total_orders_count + 1;
    local_order_id := NULL;
    order_qr_id := order_data->>'qr_id';
    
    RAISE NOTICE 'Processing order: AlWaseet ID=%, QR ID=%', order_data->>'id', order_qr_id;
    
    -- Try to find the local order by delivery_partner_order_id first
    SELECT id INTO local_order_id
    FROM public.orders 
    WHERE delivery_partner_order_id = (order_data->>'id')::text
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND (created_by = v_current_user_id OR is_admin_or_deputy())
    LIMIT 1;
    
    -- If not found, try by tracking_number matching qr_id
    IF local_order_id IS NULL AND order_qr_id IS NOT NULL AND order_qr_id != '' THEN
      SELECT id INTO local_order_id
      FROM public.orders 
      WHERE tracking_number = order_qr_id
      AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
      AND (created_by = v_current_user_id OR is_admin_or_deputy())
      LIMIT 1;
      
      -- If found by qr_id, update the delivery_partner_order_id for future matching
      IF local_order_id IS NOT NULL THEN
        UPDATE public.orders 
        SET delivery_partner_order_id = (order_data->>'id')::text,
            updated_at = now()
        WHERE id = local_order_id;
        RAISE NOTICE 'Updated order % with delivery_partner_order_id %', local_order_id, order_data->>'id';
      END IF;
    END IF;
    
    -- Insert or update the delivery invoice order
    INSERT INTO public.delivery_invoice_orders (
      invoice_id,
      order_id,
      external_order_id,
      raw,
      owner_user_id
    ) VALUES (
      v_invoice_id,
      local_order_id,
      order_data->>'id',
      order_data,
      v_current_user_id
    )
    ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
      order_id = EXCLUDED.order_id,
      raw = EXCLUDED.raw,
      owner_user_id = COALESCE(public.delivery_invoice_orders.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();
    
    IF local_order_id IS NOT NULL THEN
      linked_orders_count := linked_orders_count + 1;
      RAISE NOTICE 'Successfully linked local order % with AlWaseet order %', local_order_id, order_data->>'id';
    ELSE
      RAISE NOTICE 'Could not find local order for AlWaseet order % (QR: %)', order_data->>'id', order_qr_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Invoice sync complete: total_orders=%, linked_orders=%, invoice_received=%', 
              total_orders_count, linked_orders_count, invoice_received;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'total_orders', total_orders_count,
    'linked_orders', linked_orders_count,
    'invoice_received', invoice_received
  );
END;
$function$;

-- Fix the trigger to work on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_propagate_invoice_received_to_orders ON public.delivery_invoices;

CREATE TRIGGER trg_propagate_invoice_received_to_orders
  AFTER INSERT OR UPDATE ON public.delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION propagate_invoice_received_to_orders();

-- Create function to retroactively link orders missing delivery_partner_order_id
CREATE OR REPLACE FUNCTION public.retroactive_link_orders_by_qr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  linked_count integer := 0;
  order_record RECORD;
  invoice_order_record RECORD;
BEGIN
  -- Find orders with tracking_number but missing delivery_partner_order_id
  FOR order_record IN 
    SELECT o.id, o.tracking_number
    FROM public.orders o
    WHERE o.tracking_number IS NOT NULL 
    AND o.tracking_number != ''
    AND (o.delivery_partner_order_id IS NULL OR o.delivery_partner_order_id = '')
    AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
  LOOP
    -- Find matching delivery invoice orders by qr_id
    SELECT dio.external_order_id INTO invoice_order_record
    FROM public.delivery_invoice_orders dio
    WHERE (dio.raw->>'qr_id') = order_record.tracking_number
    LIMIT 1;
    
    IF FOUND THEN
      -- Update the order with the delivery_partner_order_id
      UPDATE public.orders 
      SET delivery_partner_order_id = invoice_order_record.external_order_id,
          updated_at = now()
      WHERE id = order_record.id;
      
      -- Update the delivery_invoice_orders to link to this order
      UPDATE public.delivery_invoice_orders 
      SET order_id = order_record.id,
          updated_at = now()
      WHERE external_order_id = invoice_order_record.external_order_id
      AND order_id IS NULL;
      
      linked_count := linked_count + 1;
      RAISE NOTICE 'Retroactively linked order % (tracking: %) with AlWaseet order %', 
                   order_record.id, order_record.tracking_number, invoice_order_record.external_order_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'linked_orders_count', linked_count,
    'message', 'Retroactively linked ' || linked_count || ' orders'
  );
END;
$function$;

-- Create function to sync recently received invoices
CREATE OR REPLACE FUNCTION public.sync_recent_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  updated_orders_count integer := 0;
  invoice_record RECORD;
BEGIN
  -- Find recently received invoices and update linked orders
  FOR invoice_record IN 
    SELECT di.id, di.external_id, di.received_at
    FROM public.delivery_invoices di
    WHERE di.received = true
    AND di.received_at >= now() - interval '7 days'
    AND di.partner = 'alwaseet'
  LOOP
    -- Update orders linked to this invoice
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = invoice_record.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;

    GET DIAGNOSTICS updated_orders_count = ROW_COUNT;
    
    -- Also update orders linked by delivery_partner_order_id
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = invoice_record.id
      )
      AND o.receipt_received = false
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet';

    GET DIAGNOSTICS updated_orders_count = updated_orders_count + ROW_COUNT;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_orders_count,
    'message', 'Updated ' || updated_orders_count || ' orders from recent received invoices'
  );
END;
$function$;