-- ✅ تحديث دالة admin_manage_invoice_cron لتجنب لمس jobs القديمة نهائياً
CREATE OR REPLACE FUNCTION public.admin_manage_invoice_cron(
  p_action TEXT DEFAULT 'update_schedule',
  p_morning_time TIME DEFAULT '09:00'::TIME,
  p_evening_time TIME DEFAULT '21:00'::TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
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
    -- ⚠️ لا نلمس smart-invoice-sync-* نهائياً (مملوكة لمستخدم آخر)
    -- فقط نتعامل مع invoice-sync-am/pm
    
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
    -- Safely clean up existing before re-enabling
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-am') INTO v_job_exists;
    IF v_job_exists THEN PERFORM cron.unschedule('invoice-sync-am'); END IF;
    
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-pm') INTO v_job_exists;
    IF v_job_exists THEN PERFORM cron.unschedule('invoice-sync-pm'); END IF;
    
    PERFORM cron.schedule('invoice-sync-am', v_morning_cron, v_job_command);
    PERFORM cron.schedule('invoice-sync-pm', v_evening_cron, v_job_command);
    
    UPDATE public.auto_sync_schedule_settings SET enabled = true, updated_at = now();
    
    v_result := jsonb_build_object('success', true, 'message', 'تم تفعيل المزامنة التلقائية');
  END IF;
  
  RETURN v_result;
END;
$$;

-- ✅ تحديث get_invoice_cron_status لإظهار invoice-sync-am/pm فقط
CREATE OR REPLACE FUNCTION public.get_invoice_cron_status()
RETURNS TABLE (
  job_name TEXT,
  schedule TEXT,
  is_active BOOLEAN,
  next_run_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::text as job_name,
    j.schedule::text as schedule,
    j.active as is_active,
    CASE 
      WHEN j.active THEN NOW() + INTERVAL '1 hour'
      ELSE NULL
    END as next_run_at
  FROM cron.job j
  WHERE j.jobname IN ('invoice-sync-am', 'invoice-sync-pm')  -- ✅ فقط الـ jobs الجديدة
  ORDER BY j.jobname;
END;
$$;

-- ✅ منح الصلاحيات
ALTER FUNCTION public.admin_manage_invoice_cron(TEXT, TIME, TIME) OWNER TO postgres;
ALTER FUNCTION public.get_invoice_cron_status() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(TEXT, TIME, TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(TEXT, TIME, TIME) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_cron_status() TO anon;