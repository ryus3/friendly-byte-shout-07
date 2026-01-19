-- =====================================================
-- إنشاء نظام كرون جديد للفواتير (بأسماء جديدة تتجاوز المشكلة)
-- =====================================================

-- 1) دالة إنشاء الكرون الجديد
CREATE OR REPLACE FUNCTION public.setup_invoice_sync_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_result jsonb := '{}';
  v_am_exists boolean := false;
  v_pm_exists boolean := false;
  v_function_url text := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA';
BEGIN
  -- تحقق من وجود الكرون
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-am') INTO v_am_exists;
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'invoice-sync-pm') INTO v_pm_exists;
  
  -- إنشاء كرون الصباح إذا لم يكن موجوداً
  IF NOT v_am_exists THEN
    PERFORM cron.schedule(
      'invoice-sync-am',
      '0 9 * * *',
      format(
        $cmd$SELECT net.http_post(
          url:='%s',
          headers:='{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
          body:='{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":false}'::jsonb
        )$cmd$,
        v_function_url, v_anon_key
      )
    );
    v_result := v_result || '{"am_created": true}'::jsonb;
  ELSE
    v_result := v_result || '{"am_exists": true}'::jsonb;
  END IF;
  
  -- إنشاء كرون المساء إذا لم يكن موجوداً
  IF NOT v_pm_exists THEN
    PERFORM cron.schedule(
      'invoice-sync-pm',
      '0 21 * * *',
      format(
        $cmd$SELECT net.http_post(
          url:='%s',
          headers:='{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
          body:='{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":true}'::jsonb
        )$cmd$,
        v_function_url, v_anon_key
      )
    );
    v_result := v_result || '{"pm_created": true}'::jsonb;
  ELSE
    v_result := v_result || '{"pm_exists": true}'::jsonb;
  END IF;
  
  RETURN v_result;
END;
$$;

-- 2) تحديث دالة إدارة الكرون لتستخدم الأسماء الجديدة
CREATE OR REPLACE FUNCTION public.admin_manage_invoice_cron(
  p_action text,
  p_morning_time time DEFAULT '09:00'::time,
  p_evening_time time DEFAULT '21:00'::time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_result jsonb := '{}';
  v_am_schedule text;
  v_pm_schedule text;
  v_am_jobid bigint;
  v_pm_jobid bigint;
  v_function_url text := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA';
BEGIN
  -- بناء جداول الكرون
  v_am_schedule := EXTRACT(MINUTE FROM p_morning_time)::text || ' ' || EXTRACT(HOUR FROM p_morning_time)::text || ' * * *';
  v_pm_schedule := EXTRACT(MINUTE FROM p_evening_time)::text || ' ' || EXTRACT(HOUR FROM p_evening_time)::text || ' * * *';
  
  -- الحصول على معرفات الوظائف (الأسماء الجديدة)
  SELECT jobid INTO v_am_jobid FROM cron.job WHERE jobname = 'invoice-sync-am';
  SELECT jobid INTO v_pm_jobid FROM cron.job WHERE jobname = 'invoice-sync-pm';
  
  IF p_action = 'enable' THEN
    -- تفعيل أو إنشاء كرون الصباح
    IF v_am_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_am_jobid, schedule := v_am_schedule, active := true);
    ELSE
      PERFORM cron.schedule(
        'invoice-sync-am',
        v_am_schedule,
        format(
          $cmd$SELECT net.http_post(
            url:='%s',
            headers:='{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
            body:='{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":false}'::jsonb
          )$cmd$,
          v_function_url, v_anon_key
        )
      );
    END IF;
    
    -- تفعيل أو إنشاء كرون المساء
    IF v_pm_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_pm_jobid, schedule := v_pm_schedule, active := true);
    ELSE
      PERFORM cron.schedule(
        'invoice-sync-pm',
        v_pm_schedule,
        format(
          $cmd$SELECT net.http_post(
            url:='%s',
            headers:='{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
            body:='{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":true}'::jsonb
          )$cmd$,
          v_function_url, v_anon_key
        )
      );
    END IF;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'enabled',
      'morning_schedule', v_am_schedule,
      'evening_schedule', v_pm_schedule
    );
    
  ELSIF p_action = 'disable' THEN
    -- تعطيل الكرون
    IF v_am_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_am_jobid, active := false);
    END IF;
    IF v_pm_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_pm_jobid, active := false);
    END IF;
    
    v_result := jsonb_build_object('success', true, 'action', 'disabled');
    
  ELSIF p_action = 'update_schedule' THEN
    -- تحديث الجدول فقط
    IF v_am_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_am_jobid, schedule := v_am_schedule);
    END IF;
    IF v_pm_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_pm_jobid, schedule := v_pm_schedule);
    END IF;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'schedule_updated',
      'morning_schedule', v_am_schedule,
      'evening_schedule', v_pm_schedule
    );
    
  ELSIF p_action = 'status' THEN
    -- حالة الكرون
    v_result := jsonb_build_object(
      'success', true,
      'am_exists', v_am_jobid IS NOT NULL,
      'pm_exists', v_pm_jobid IS NOT NULL,
      'am_jobid', v_am_jobid,
      'pm_jobid', v_pm_jobid
    );
  ELSE
    v_result := jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action);
  END IF;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3) تشغيل دالة الإعداد لإنشاء الكرون الجديد فوراً
SELECT public.setup_invoice_sync_cron();