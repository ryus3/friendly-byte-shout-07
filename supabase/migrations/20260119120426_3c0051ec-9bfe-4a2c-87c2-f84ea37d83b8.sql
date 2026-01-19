-- =====================================================
-- FIX 1: Drop and recreate update_invoice_sync_schedule with proper type casting
-- =====================================================
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(text, text);

CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_morning_time TEXT DEFAULT '09:00',
  p_evening_time TEXT DEFAULT '21:00'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_morning_time TIME;
  v_evening_time TIME;
  v_result JSONB;
BEGIN
  -- Validate and convert morning time
  BEGIN
    v_morning_time := p_morning_time::TIME;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'تنسيق وقت الصباح غير صحيح. استخدم HH:MM (مثال: 09:00)'
    );
  END;
  
  -- Validate and convert evening time
  BEGIN
    v_evening_time := p_evening_time::TIME;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'تنسيق وقت المساء غير صحيح. استخدم HH:MM (مثال: 21:00)'
    );
  END;
  
  -- Call admin_manage_invoice_cron with proper TIME types
  v_result := public.admin_manage_invoice_cron('update_schedule'::TEXT, v_morning_time, v_evening_time);
  
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_invoice_sync_schedule(TEXT, TEXT) TO authenticated;

-- =====================================================
-- FIX 2: Update admin_manage_invoice_cron with safe job cleanup
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_manage_invoice_cron(
  p_action TEXT,
  p_morning_time TIME DEFAULT '09:00'::TIME,
  p_evening_time TIME DEFAULT '21:00'::TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_morning_cron TEXT;
  v_evening_cron TEXT;
  v_job_command TEXT;
  v_result JSONB := '{}'::JSONB;
  v_job_exists BOOLEAN;
BEGIN
  -- Build cron expressions from time
  v_morning_cron := EXTRACT(MINUTE FROM p_morning_time)::TEXT || ' ' || EXTRACT(HOUR FROM p_morning_time)::TEXT || ' * * *';
  v_evening_cron := EXTRACT(MINUTE FROM p_evening_time)::TEXT || ' ' || EXTRACT(HOUR FROM p_evening_time)::TEXT || ' * * *';
  
  -- The command to execute
  v_job_command := $cmd$
    SELECT net.http_post(
      url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
      body := '{"mode": "comprehensive", "sync_invoices": true, "sync_orders": true, "force_refresh": true}'::jsonb
    );
  $cmd$;

  IF p_action = 'update_schedule' THEN
    -- Safely clean up old jobs (only if they exist)
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'smart-invoice-sync-morning') INTO v_job_exists;
    IF v_job_exists THEN
      PERFORM cron.unschedule('smart-invoice-sync-morning');
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'smart-invoice-sync-evening') INTO v_job_exists;
    IF v_job_exists THEN
      PERFORM cron.unschedule('smart-invoice-sync-evening');
    END IF;
    
    -- Safely unschedule existing jobs (only if they exist)
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-am') INTO v_job_exists;
    IF v_job_exists THEN
      PERFORM cron.unschedule('invoice-sync-am');
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-pm') INTO v_job_exists;
    IF v_job_exists THEN
      PERFORM cron.unschedule('invoice-sync-pm');
    END IF;
    
    -- Schedule new jobs
    PERFORM cron.schedule('invoice-sync-am', v_morning_cron, v_job_command);
    PERFORM cron.schedule('invoice-sync-pm', v_evening_cron, v_job_command);
    
    -- Update settings table
    UPDATE public.auto_sync_schedule_settings
    SET 
      sync_times = ARRAY[p_morning_time::TEXT, p_evening_time::TEXT],
      enabled = true,
      updated_at = now()
    WHERE id = (SELECT id FROM public.auto_sync_schedule_settings LIMIT 1);
    
    IF NOT FOUND THEN
      INSERT INTO public.auto_sync_schedule_settings (sync_times, enabled, timezone)
      VALUES (ARRAY[p_morning_time::TEXT, p_evening_time::TEXT], true, 'Asia/Baghdad');
    END IF;
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'تم تحديث جدولة المزامنة بنجاح',
      'morning_time', p_morning_time::TEXT,
      'evening_time', p_evening_time::TEXT,
      'morning_cron', v_morning_cron,
      'evening_cron', v_evening_cron
    );
    
  ELSIF p_action = 'disable' THEN
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-am') INTO v_job_exists;
    IF v_job_exists THEN PERFORM cron.unschedule('invoice-sync-am'); END IF;
    
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-pm') INTO v_job_exists;
    IF v_job_exists THEN PERFORM cron.unschedule('invoice-sync-pm'); END IF;
    
    UPDATE public.auto_sync_schedule_settings SET enabled = false, updated_at = now();
    
    v_result := jsonb_build_object('success', true, 'message', 'تم تعطيل المزامنة التلقائية');
    
  ELSIF p_action = 'enable' THEN
    PERFORM cron.schedule('invoice-sync-am', v_morning_cron, v_job_command);
    PERFORM cron.schedule('invoice-sync-pm', v_evening_cron, v_job_command);
    
    UPDATE public.auto_sync_schedule_settings SET enabled = true, updated_at = now();
    
    v_result := jsonb_build_object('success', true, 'message', 'تم تفعيل المزامنة التلقائية');
  END IF;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(TEXT, TIME, TIME) TO authenticated;