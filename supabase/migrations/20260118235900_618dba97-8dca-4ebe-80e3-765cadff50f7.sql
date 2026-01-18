-- تحديث دالة إدارة cron للفواتير لتعمل بشكل صحيح مع jobs المملوكة لـ postgres
-- استخدام jobid بدلاً من jobname لتفادي مشاكل الملكية

DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text, time, time);

CREATE OR REPLACE FUNCTION public.admin_manage_invoice_cron(
  p_action text,
  p_morning_time time DEFAULT '09:00:00'::time,
  p_evening_time time DEFAULT '21:00:00'::time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $func$
DECLARE
  v_morning_jobid bigint;
  v_evening_jobid bigint;
  v_morning_schedule text;
  v_evening_schedule text;
  v_edge_url text := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync';
  v_auth_header text := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA';
  v_morning_command text;
  v_evening_command text;
  v_result jsonb;
BEGIN
  -- البحث عن jobid الحالية (بغض النظر عن المالك)
  SELECT jobid INTO v_morning_jobid 
  FROM cron.job 
  WHERE jobname = 'smart-invoice-sync-morning'
  LIMIT 1;
  
  SELECT jobid INTO v_evening_jobid 
  FROM cron.job 
  WHERE jobname = 'smart-invoice-sync-evening'
  LIMIT 1;

  -- إذا كان الطلب هو الحصول على الحالة فقط
  IF p_action = 'get_status' THEN
    RETURN jsonb_build_object(
      'success', true,
      'morning_job', CASE WHEN v_morning_jobid IS NOT NULL THEN
        (SELECT jsonb_build_object('jobid', jobid, 'schedule', schedule, 'active', active, 'username', username)
         FROM cron.job WHERE jobid = v_morning_jobid)
      ELSE null END,
      'evening_job', CASE WHEN v_evening_jobid IS NOT NULL THEN
        (SELECT jsonb_build_object('jobid', jobid, 'schedule', schedule, 'active', active, 'username', username)
         FROM cron.job WHERE jobid = v_evening_jobid)
      ELSE null END
    );
  END IF;

  -- تعطيل Jobs
  IF p_action = 'disable' THEN
    IF v_morning_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_morning_jobid);
    END IF;
    IF v_evening_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_evening_jobid);
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Invoice sync jobs disabled',
      'morning_unscheduled', v_morning_jobid IS NOT NULL,
      'evening_unscheduled', v_evening_jobid IS NOT NULL
    );
  END IF;

  -- تطبيق الجدولة
  IF p_action = 'apply_schedule' THEN
    -- بناء جدول cron من الوقت
    v_morning_schedule := format('%s %s * * *', EXTRACT(MINUTE FROM p_morning_time)::int, EXTRACT(HOUR FROM p_morning_time)::int);
    v_evening_schedule := format('%s %s * * *', EXTRACT(MINUTE FROM p_evening_time)::int, EXTRACT(HOUR FROM p_evening_time)::int);
    
    -- بناء الأوامر
    v_morning_command := format(
      $cmd$SELECT net.http_post(url:='%s', headers:='{"Content-Type":"application/json","Authorization":"%s"}'::jsonb, body:='{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":false}'::jsonb);$cmd$,
      v_edge_url, v_auth_header
    );
    
    v_evening_command := format(
      $cmd$SELECT net.http_post(url:='%s', headers:='{"Content-Type":"application/json","Authorization":"%s"}'::jsonb, body:='{"mode":"comprehensive","sync_invoices":true,"sync_orders":true,"force_refresh":true}'::jsonb);$cmd$,
      v_edge_url, v_auth_header
    );

    -- إذا Jobs موجودة، نستخدم alter_job لتحديثها
    IF v_morning_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_morning_jobid, schedule := v_morning_schedule, command := v_morning_command);
    ELSE
      -- إنشاء job جديد
      SELECT cron.schedule_in_database('smart-invoice-sync-morning', v_morning_schedule, v_morning_command, 'postgres') INTO v_morning_jobid;
    END IF;
    
    IF v_evening_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_evening_jobid, schedule := v_evening_schedule, command := v_evening_command);
    ELSE
      SELECT cron.schedule_in_database('smart-invoice-sync-evening', v_evening_schedule, v_evening_command, 'postgres') INTO v_evening_jobid;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Invoice sync schedule applied',
      'morning_schedule', v_morning_schedule,
      'evening_schedule', v_evening_schedule,
      'morning_jobid', v_morning_jobid,
      'evening_jobid', v_evening_jobid
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$func$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(text, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_invoice_cron(text, time, time) TO service_role;