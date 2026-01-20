-- Fix admin_manage_invoice_cron to convert Baghdad time to UTC for cron expressions
CREATE OR REPLACE FUNCTION public.admin_manage_invoice_cron(
  p_morning_time TEXT,
  p_evening_time TEXT,
  p_enabled BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $func$
DECLARE
  v_morning_utc TIME;
  v_evening_utc TIME;
  v_morning_hour INT;
  v_morning_minute INT;
  v_evening_hour INT;
  v_evening_minute INT;
  v_morning_cron TEXT;
  v_evening_cron TEXT;
  v_morning_cmd TEXT;
  v_evening_cmd TEXT;
  v_result jsonb := '{"success": true}'::jsonb;
BEGIN
  -- Convert Baghdad time (Asia/Baghdad = UTC+3) to UTC
  -- Baghdad is 3 hours ahead of UTC, so subtract 3 hours
  v_morning_utc := (p_morning_time::TIME - INTERVAL '3 hours')::TIME;
  v_evening_utc := (p_evening_time::TIME - INTERVAL '3 hours')::TIME;
  
  -- Extract hour and minute for cron expressions
  v_morning_hour := EXTRACT(HOUR FROM v_morning_utc);
  v_morning_minute := EXTRACT(MINUTE FROM v_morning_utc);
  v_evening_hour := EXTRACT(HOUR FROM v_evening_utc);
  v_evening_minute := EXTRACT(MINUTE FROM v_evening_utc);

  -- Build cron expressions
  v_morning_cron := v_morning_minute || ' ' || v_morning_hour || ' * * *';
  v_evening_cron := v_evening_minute || ' ' || v_evening_hour || ' * * *';

  -- Build command strings
  v_morning_cmd := 'SELECT net.http_post(url := ''https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}''::jsonb, body := ''{"mode": "comprehensive", "sync_invoices": true, "sync_orders": true, "force_refresh": false}''::jsonb);';
  
  v_evening_cmd := 'SELECT net.http_post(url := ''https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}''::jsonb, body := ''{"mode": "comprehensive", "sync_invoices": true, "sync_orders": true, "force_refresh": false}''::jsonb);';

  -- Safely unschedule existing jobs (only invoice-sync-am/pm)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-am') THEN
    PERFORM cron.unschedule('invoice-sync-am');
  END IF;
  
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-pm') THEN
    PERFORM cron.unschedule('invoice-sync-pm');
  END IF;

  -- Schedule new jobs if enabled
  IF p_enabled THEN
    PERFORM cron.schedule('invoice-sync-am', v_morning_cron, v_morning_cmd);
    PERFORM cron.schedule('invoice-sync-pm', v_evening_cron, v_evening_cmd);
  END IF;

  -- Update auto_sync_schedule_settings with Baghdad times (for display)
  INSERT INTO public.auto_sync_schedule_settings (id, sync_times, enabled, timezone, updated_at)
  VALUES (
    'default',
    ARRAY[p_morning_time, p_evening_time],
    p_enabled,
    'Asia/Baghdad',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    sync_times = ARRAY[p_morning_time, p_evening_time],
    enabled = p_enabled,
    timezone = 'Asia/Baghdad',
    updated_at = NOW();

  v_result := jsonb_build_object(
    'success', true,
    'morning_time_baghdad', p_morning_time,
    'evening_time_baghdad', p_evening_time,
    'morning_time_utc', v_morning_utc::TEXT,
    'evening_time_utc', v_evening_utc::TEXT,
    'morning_cron', v_morning_cron,
    'evening_cron', v_evening_cron,
    'enabled', p_enabled
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(TEXT, TEXT, BOOLEAN) TO anon;