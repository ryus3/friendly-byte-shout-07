-- Fix the ambiguous column reference in sync_alwaseet_invoice_data function
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

  -- Process each order in the invoice
  FOR order_data IN SELECT * FROM jsonb_array_elements(p_orders_data)
  LOOP
    total_orders_count := total_orders_count + 1;
    
    -- Try to find the local order by delivery_partner_order_id first
    SELECT id INTO local_order_id
    FROM public.orders 
    WHERE delivery_partner_order_id = (order_data->>'id')::text
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND (created_by = v_current_user_id OR is_admin_or_deputy())
    LIMIT 1;
    
    -- If not found, try by tracking_number
    IF local_order_id IS NULL THEN
      SELECT id INTO local_order_id
      FROM public.orders 
      WHERE tracking_number = (order_data->>'id')::text
      AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
      AND (created_by = v_current_user_id OR is_admin_or_deputy())
      LIMIT 1;
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
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'total_orders', total_orders_count,
    'linked_orders', linked_orders_count,
    'invoice_received', invoice_received
  );
END;
$function$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_external_partner ON public.delivery_invoices(external_id, partner);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_owner_user ON public.delivery_invoices(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_invoice_orders_invoice_external ON public.delivery_invoice_orders(invoice_id, external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_order_id ON public.orders(delivery_partner_order_id) WHERE delivery_partner_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number_partner ON public.orders(tracking_number, delivery_partner) WHERE tracking_number IS NOT NULL;

-- Recreate the propagate trigger
DROP TRIGGER IF EXISTS trg_propagate_invoice_received ON public.delivery_invoices;
CREATE TRIGGER trg_propagate_invoice_received
  AFTER UPDATE OF received ON public.delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_invoice_received_to_orders();