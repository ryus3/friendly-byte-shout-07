-- Fix pg_net permissions for cron jobs to call edge functions
-- Grant necessary permissions on net schema and functions

-- Grant usage on net schema to postgres role (cron executor)
GRANT USAGE ON SCHEMA net TO postgres;

-- Grant execute on net.http_post function
GRANT EXECUTE ON FUNCTION net.http_post(url text, params jsonb, headers jsonb, body jsonb, timeout_milliseconds integer) TO postgres;

-- Also grant on the simpler overloads if they exist
DO $$
BEGIN
  -- Try granting on common overloads
  EXECUTE 'GRANT EXECUTE ON FUNCTION net.http_post(text, jsonb, jsonb, jsonb) TO postgres';
EXCEPTION WHEN undefined_function THEN
  -- Function signature doesn't exist, skip
  NULL;
END $$;

-- Grant on net.http_get as well for completeness
GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO postgres;

-- Update upsert_alwaseet_invoice_list to derive received from status
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list(p_invoices jsonb, p_owner_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  inv jsonb;
  v_status text;
  v_received boolean;
  v_status_normalized text;
BEGIN
  FOR inv IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    -- Extract status
    v_status := inv->>'status';
    
    -- Derive received and status_normalized from status text
    -- Check for received status patterns (Arabic text variations)
    IF v_status IS NOT NULL AND (
       v_status ILIKE '%تم الاستلام%' OR
       v_status ILIKE '%مستلم%' OR
       v_status ILIKE '%received%' OR
       v_status ILIKE '%التاجر%'
    ) THEN
      v_received := true;
      v_status_normalized := 'received';
    ELSIF v_status IS NOT NULL AND (
       v_status ILIKE '%ملغ%' OR
       v_status ILIKE '%cancel%'
    ) THEN
      v_received := false;
      v_status_normalized := 'cancelled';
    ELSIF v_status IS NOT NULL AND (
       v_status ILIKE '%معلق%' OR
       v_status ILIKE '%pending%' OR
       v_status ILIKE '%انتظار%'
    ) THEN
      v_received := false;
      v_status_normalized := 'pending';
    ELSE
      -- Default: use existing received value or false
      v_received := COALESCE((inv->>'received')::boolean, false);
      v_status_normalized := 'pending';
    END IF;

    INSERT INTO delivery_invoices (
      external_id,
      partner,
      amount,
      issued_at,
      status,
      status_normalized,
      received,
      received_at,
      raw,
      owner_user_id,
      merchant_id,
      account_username,
      orders_count,
      last_synced_at
    ) VALUES (
      inv->>'id',
      'alwaseet',
      (inv->>'amount')::numeric,
      (inv->>'created_at')::timestamptz,
      v_status,
      v_status_normalized,
      v_received,
      CASE WHEN v_received THEN COALESCE((inv->>'received_at')::timestamptz, now()) ELSE NULL END,
      inv,
      p_owner_user_id,
      inv->>'merchant_id',
      inv->>'account_username',
      (inv->>'orders_count')::int,
      now()
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = EXCLUDED.amount,
      issued_at = EXCLUDED.issued_at,
      status = EXCLUDED.status,
      status_normalized = EXCLUDED.status_normalized,
      received = EXCLUDED.received,
      received_at = CASE 
        WHEN EXCLUDED.received AND delivery_invoices.received_at IS NULL THEN now()
        WHEN EXCLUDED.received THEN COALESCE(EXCLUDED.received_at, delivery_invoices.received_at)
        ELSE delivery_invoices.received_at
      END,
      raw = EXCLUDED.raw,
      merchant_id = EXCLUDED.merchant_id,
      account_username = EXCLUDED.account_username,
      orders_count = EXCLUDED.orders_count,
      last_synced_at = now(),
      updated_at = now();
  END LOOP;
END;
$function$;