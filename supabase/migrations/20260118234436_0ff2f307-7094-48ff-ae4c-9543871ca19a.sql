-- حذف جميع نسخ الدالة القديمة
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule();
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(boolean);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(boolean, text);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(boolean, text, time);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(boolean, text, time, time);
DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text);
DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text, time);
DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text, time, time);

-- إنشاء دالة إدارة cron
CREATE FUNCTION public.admin_manage_invoice_cron(
  p_action text,
  p_morning_time time DEFAULT '09:00:00',
  p_evening_time time DEFAULT '21:00:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $func$
DECLARE
  v_morning_hour int;
  v_morning_minute int;
  v_evening_hour int;
  v_evening_minute int;
  v_morning_cron text;
  v_evening_cron text;
  v_morning_command text;
  v_evening_command text;
  v_morning_job_id bigint;
  v_evening_job_id bigint;
  v_result jsonb;
BEGIN
  IF p_action = 'get_status' THEN
    SELECT jsonb_build_object(
      'morning_job', (SELECT row_to_json(j.*) FROM cron.job j WHERE j.jobname = 'smart-invoice-sync-morning'),
      'evening_job', (SELECT row_to_json(j.*) FROM cron.job j WHERE j.jobname = 'smart-invoice-sync-evening')
    ) INTO v_result;
    RETURN v_result;
  END IF;

  v_morning_hour := EXTRACT(HOUR FROM p_morning_time)::int;
  v_morning_minute := EXTRACT(MINUTE FROM p_morning_time)::int;
  v_evening_hour := EXTRACT(HOUR FROM p_evening_time)::int;
  v_evening_minute := EXTRACT(MINUTE FROM p_evening_time)::int;
  
  v_morning_cron := v_morning_minute || ' ' || v_morning_hour || ' * * *';
  v_evening_cron := v_evening_minute || ' ' || v_evening_hour || ' * * *';

  v_morning_command := 'SELECT net.http_post(url := ''https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}''::jsonb, body := ''{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":false}''::jsonb);';
  
  v_evening_command := 'SELECT net.http_post(url := ''https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}''::jsonb, body := ''{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":true}''::jsonb);';

  IF p_action = 'disable' THEN
    BEGIN
      PERFORM cron.unschedule('smart-invoice-sync-morning');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('smart-invoice-sync-evening');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object('success', true, 'action', 'disabled');
  END IF;

  IF p_action = 'apply_schedule' THEN
    BEGIN
      PERFORM cron.unschedule('smart-invoice-sync-morning');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('smart-invoice-sync-evening');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    SELECT cron.schedule_in_database('smart-invoice-sync-morning', v_morning_cron, v_morning_command, 'postgres') INTO v_morning_job_id;
    SELECT cron.schedule_in_database('smart-invoice-sync-evening', v_evening_cron, v_evening_command, 'postgres') INTO v_evening_job_id;

    RETURN jsonb_build_object('success', true, 'morning_job_id', v_morning_job_id, 'evening_job_id', v_evening_job_id, 'morning_cron', v_morning_cron, 'evening_cron', v_evening_cron);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unknown action');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$func$;

-- إنشاء دالة تحديث الإعدادات
CREATE FUNCTION public.update_invoice_sync_schedule(
  p_enabled boolean DEFAULT true,
  p_frequency text DEFAULT 'twice_daily',
  p_morning_time time DEFAULT '09:00:00',
  p_evening_time time DEFAULT '21:00:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_settings_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_cron_result jsonb;
BEGIN
  INSERT INTO invoice_sync_settings (id, daily_sync_enabled, sync_frequency, morning_sync_time, evening_sync_time, updated_at)
  VALUES (v_settings_id, p_enabled, p_frequency, p_morning_time, p_evening_time, NOW())
  ON CONFLICT (id) DO UPDATE SET
    daily_sync_enabled = EXCLUDED.daily_sync_enabled,
    sync_frequency = EXCLUDED.sync_frequency,
    morning_sync_time = EXCLUDED.morning_sync_time,
    evening_sync_time = EXCLUDED.evening_sync_time,
    updated_at = NOW();

  IF p_enabled THEN
    SELECT public.admin_manage_invoice_cron('apply_schedule', p_morning_time, p_evening_time) INTO v_cron_result;
  ELSE
    SELECT public.admin_manage_invoice_cron('disable') INTO v_cron_result;
  END IF;

  RETURN jsonb_build_object(
    'success', COALESCE((v_cron_result->>'success')::boolean, false),
    'settings_saved', true,
    'cron_applied', COALESCE((v_cron_result->>'success')::boolean, false),
    'enabled', p_enabled,
    'cron_details', v_cron_result
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(text, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(text, time, time) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_invoice_sync_schedule(boolean, text, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_sync_schedule(boolean, text, time, time) TO service_role;