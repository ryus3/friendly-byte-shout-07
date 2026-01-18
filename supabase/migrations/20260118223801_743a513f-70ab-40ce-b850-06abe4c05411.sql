-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS update_invoice_sync_schedule(boolean, text, text, text);

-- إعادة بناء الدالة بالشكل الصحيح
CREATE OR REPLACE FUNCTION update_invoice_sync_schedule(
  p_enabled BOOLEAN,
  p_frequency TEXT,
  p_morning_time TEXT,
  p_evening_time TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  v_morning_time TIME;
  v_evening_time TIME;
  v_morning_hour INT;
  v_morning_min INT;
  v_evening_hour INT;
  v_evening_min INT;
  v_result JSONB;
  v_settings_id UUID;
  v_cron_schedule_morning TEXT;
  v_cron_schedule_evening TEXT;
  v_http_command TEXT;
BEGIN
  -- Parse times
  BEGIN
    v_morning_time := p_morning_time::TIME;
    v_evening_time := p_evening_time::TIME;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid time format: ' || SQLERRM);
  END;
  
  -- Extract hours and minutes
  v_morning_hour := EXTRACT(HOUR FROM v_morning_time);
  v_morning_min := EXTRACT(MINUTE FROM v_morning_time);
  v_evening_hour := EXTRACT(HOUR FROM v_evening_time);
  v_evening_min := EXTRACT(MINUTE FROM v_evening_time);
  
  -- Build cron schedules
  v_cron_schedule_morning := format('%s %s * * *', v_morning_min, v_morning_hour);
  v_cron_schedule_evening := format('%s %s * * *', v_evening_min, v_evening_hour);
  
  -- HTTP command for sync
  v_http_command := 'SELECT net.http_post(url := ''https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}''::jsonb, body := ''{"mode": "comprehensive", "sync_invoices": true, "sync_orders": false, "force_refresh": false}''::jsonb)';
  
  -- Ensure single row exists in invoice_sync_settings
  SELECT id INTO v_settings_id FROM invoice_sync_settings LIMIT 1;
  
  IF v_settings_id IS NULL THEN
    INSERT INTO invoice_sync_settings (
      daily_sync_enabled,
      sync_frequency,
      morning_sync_time,
      evening_sync_time
    ) VALUES (
      p_enabled,
      p_frequency,
      v_morning_time,
      v_evening_time
    )
    RETURNING id INTO v_settings_id;
  ELSE
    UPDATE invoice_sync_settings
    SET 
      daily_sync_enabled = p_enabled,
      sync_frequency = p_frequency,
      morning_sync_time = v_morning_time,
      evening_sync_time = v_evening_time,
      updated_at = NOW()
    WHERE id = v_settings_id;
  END IF;
  
  -- Remove existing cron jobs
  DELETE FROM cron.job WHERE jobname IN ('smart-invoice-sync-morning', 'smart-invoice-sync-evening');
  
  -- Create new cron jobs if enabled
  IF p_enabled THEN
    -- Morning sync job
    PERFORM cron.schedule('smart-invoice-sync-morning', v_cron_schedule_morning, v_http_command);
    
    -- Evening sync job (only if frequency is 'twice_daily')
    IF p_frequency = 'twice_daily' THEN
      PERFORM cron.schedule('smart-invoice-sync-evening', v_cron_schedule_evening, v_http_command);
    END IF;
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'frequency', p_frequency,
    'morning_time', p_morning_time,
    'evening_time', p_evening_time,
    'jobs_created', CASE WHEN p_enabled THEN 
      CASE WHEN p_frequency = 'twice_daily' THEN 2 ELSE 1 END
    ELSE 0 END
  );
  
  RETURN v_result;
END;
$$;