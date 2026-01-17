-- Fix the update_invoice_sync_schedule function to use existing ID instead of hardcoded UUID
CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
    p_enabled boolean,
    p_frequency text,
    p_morning_time text,
    p_evening_time text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id uuid;
    v_result json;
BEGIN
    -- Get existing ID or generate new one
    SELECT id INTO v_existing_id FROM invoice_sync_settings LIMIT 1;
    
    IF v_existing_id IS NULL THEN
        v_existing_id := gen_random_uuid();
    END IF;
    
    -- Upsert using the correct ID
    INSERT INTO invoice_sync_settings (
        id,
        daily_sync_enabled,
        sync_frequency,
        morning_sync_time,
        evening_sync_time,
        updated_at
    )
    VALUES (
        v_existing_id,
        p_enabled,
        p_frequency,
        p_morning_time,
        p_evening_time,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        daily_sync_enabled = EXCLUDED.daily_sync_enabled,
        sync_frequency = EXCLUDED.sync_frequency,
        morning_sync_time = EXCLUDED.morning_sync_time,
        evening_sync_time = EXCLUDED.evening_sync_time,
        updated_at = NOW();
    
    SELECT json_build_object(
        'success', true,
        'id', v_existing_id,
        'enabled', p_enabled,
        'frequency', p_frequency,
        'morning_time', p_morning_time,
        'evening_time', p_evening_time
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Also fix reconcile_invoice_receipts to work without parameters (for background sync)
CREATE OR REPLACE FUNCTION public.reconcile_invoice_receipts(p_invoice_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer := 0;
    v_result json;
BEGIN
    -- Update orders that are in received invoices but not marked as invoice_received
    IF p_invoice_id IS NOT NULL THEN
        -- Specific invoice reconciliation
        UPDATE orders o
        SET 
            invoice_received = true,
            invoice_received_at = COALESCE(o.invoice_received_at, di.received_at, NOW()),
            updated_at = NOW()
        FROM delivery_invoice_orders dio
        JOIN delivery_invoices di ON dio.invoice_id = di.id
        WHERE dio.order_id = o.id
          AND dio.invoice_id = p_invoice_id
          AND di.received = true
          AND (o.invoice_received = false OR o.invoice_received IS NULL);
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSE
        -- Full reconciliation for all received invoices
        UPDATE orders o
        SET 
            invoice_received = true,
            invoice_received_at = COALESCE(o.invoice_received_at, di.received_at, NOW()),
            updated_at = NOW()
        FROM delivery_invoice_orders dio
        JOIN delivery_invoices di ON dio.invoice_id = di.id
        WHERE dio.order_id = o.id
          AND di.received = true
          AND (o.invoice_received = false OR o.invoice_received IS NULL);
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'orders_reconciled', v_updated_count,
        'invoice_id', p_invoice_id
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;