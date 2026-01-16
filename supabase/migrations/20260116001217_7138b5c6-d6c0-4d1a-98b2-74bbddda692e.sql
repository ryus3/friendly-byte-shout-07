-- Fix upsert_alwaseet_invoice_list to cast owner_user_id to uuid
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list(p_invoices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_upserted integer := 0;
  v_invoice jsonb;
  v_external_id text;
  v_status text;
  v_status_normalized text;
  v_received boolean;
  v_owner_user_id uuid;
BEGIN
  FOR v_invoice IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_external_id := COALESCE(v_invoice->>'id', v_invoice->>'external_id');
    v_status := v_invoice->>'status';
    
    -- Cast owner_user_id from text to uuid
    BEGIN
      v_owner_user_id := (v_invoice->>'owner_user_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_owner_user_id := NULL;
    END;
    
    -- Normalize status
    v_status_normalized := CASE 
      WHEN v_status ILIKE '%التاجر%' OR v_status ILIKE '%merchant%' THEN 'received'
      WHEN v_status ILIKE '%المندوب%' OR v_status ILIKE '%delegate%' OR v_status ILIKE '%pending%' THEN 'pending'
      WHEN v_status ILIKE '%ملغ%' OR v_status ILIKE '%cancel%' THEN 'cancelled'
      ELSE 'pending'
    END;
    
    v_received := (v_status_normalized = 'received');
    
    INSERT INTO delivery_invoices (
      external_id,
      partner,
      amount,
      orders_count,
      status,
      status_normalized,
      received,
      received_flag,
      issued_at,
      received_at,
      merchant_id,
      account_username,
      partner_name_ar,
      owner_user_id,
      raw,
      last_synced_at,
      last_api_updated_at
    ) VALUES (
      v_external_id,
      COALESCE(v_invoice->>'partner', 'alwaseet'),
      COALESCE((v_invoice->>'amount')::numeric, 0),
      COALESCE((v_invoice->>'orders_count')::integer, (v_invoice->>'ordersCount')::integer, 0),
      v_status,
      v_status_normalized,
      v_received,
      v_received,
      COALESCE((v_invoice->>'issued_at')::timestamptz, (v_invoice->>'issuedAt')::timestamptz, (v_invoice->>'created_at')::timestamptz, now()),
      CASE WHEN v_received THEN COALESCE((v_invoice->>'received_at')::timestamptz, now()) ELSE NULL END,
      v_invoice->>'merchant_id',
      v_invoice->>'account_username',
      v_invoice->>'partner_name_ar',
      v_owner_user_id,
      v_invoice,
      now(),
      COALESCE((v_invoice->>'updated_at')::timestamptz, now())
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = COALESCE(EXCLUDED.amount, delivery_invoices.amount),
      orders_count = COALESCE(EXCLUDED.orders_count, delivery_invoices.orders_count),
      status = COALESCE(EXCLUDED.status, delivery_invoices.status),
      status_normalized = COALESCE(EXCLUDED.status_normalized, delivery_invoices.status_normalized),
      received = COALESCE(EXCLUDED.received, delivery_invoices.received),
      received_flag = COALESCE(EXCLUDED.received_flag, delivery_invoices.received_flag),
      received_at = CASE 
        WHEN EXCLUDED.received AND delivery_invoices.received_at IS NULL THEN now()
        ELSE COALESCE(delivery_invoices.received_at, EXCLUDED.received_at)
      END,
      owner_user_id = COALESCE(EXCLUDED.owner_user_id, delivery_invoices.owner_user_id),
      raw = EXCLUDED.raw,
      last_synced_at = now(),
      last_api_updated_at = COALESCE(EXCLUDED.last_api_updated_at, delivery_invoices.last_api_updated_at),
      updated_at = now();
    
    v_upserted := v_upserted + 1;
  END LOOP;
  
  v_result := jsonb_build_object(
    'success', true,
    'upserted', v_upserted
  );
  
  RETURN v_result;
END;
$function$;