-- ==========================================
-- الإصلاح الجذري لمشكلة جدولة مزامنة الفواتير
-- ==========================================

-- الخطوة 1: حذف كل الـ Cron Jobs المتضاربة/الخاطئة
DO $$
BEGIN
  -- حذف invoice-sync-am/pm (تستخدم URL خاطئ)
  PERFORM cron.unschedule('invoice-sync-am');
  PERFORM cron.unschedule('invoice-sync-pm');
  
  -- حذف smart-invoice-sync-morning/evening القديمة لإعادة إنشائها بالوقت الصحيح
  PERFORM cron.unschedule('smart-invoice-sync-morning');
  PERFORM cron.unschedule('smart-invoice-sync-evening');
EXCEPTION WHEN OTHERS THEN
  -- تجاهل الأخطاء إذا لم تكن موجودة
  NULL;
END $$;

-- الخطوة 2: إنشاء Cron Jobs جديدة بالإعدادات الصحيحة
-- 04:15 بغداد = 01:15 UTC
SELECT cron.schedule(
  'smart-invoice-sync-morning',
  '15 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA'
    ),
    body := jsonb_build_object(
      'mode', 'comprehensive',
      'sync_invoices', true,
      'sync_orders', true,
      'force_refresh', false
    )
  ) AS request_id;
  $$
);

-- 21:00 بغداد = 18:00 UTC
SELECT cron.schedule(
  'smart-invoice-sync-evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA'
    ),
    body := jsonb_build_object(
      'mode', 'comprehensive',
      'sync_invoices', true,
      'sync_orders', true,
      'force_refresh', false
    )
  ) AS request_id;
  $$
);

-- الخطوة 3: إصلاح دالة update_invoice_sync_schedule لتستخدم المسار الصحيح
CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_morning_time TEXT DEFAULT '04:15',
  p_evening_time TEXT DEFAULT '21:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_morning_hour INT;
  v_morning_minute INT;
  v_evening_hour INT;
  v_evening_minute INT;
  v_morning_utc_hour INT;
  v_evening_utc_hour INT;
  v_morning_cron TEXT;
  v_evening_cron TEXT;
  v_supabase_url TEXT := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA';
  v_command_template TEXT;
BEGIN
  -- استخراج الساعة والدقيقة من وقت الصباح
  v_morning_hour := EXTRACT(HOUR FROM p_morning_time::TIME);
  v_morning_minute := EXTRACT(MINUTE FROM p_morning_time::TIME);
  
  -- استخراج الساعة والدقيقة من وقت المساء
  v_evening_hour := EXTRACT(HOUR FROM p_evening_time::TIME);
  v_evening_minute := EXTRACT(MINUTE FROM p_evening_time::TIME);
  
  -- تحويل من توقيت بغداد (UTC+3) إلى UTC
  v_morning_utc_hour := (v_morning_hour - 3 + 24) % 24;
  v_evening_utc_hour := (v_evening_hour - 3 + 24) % 24;
  
  -- بناء cron expressions
  v_morning_cron := v_morning_minute || ' ' || v_morning_utc_hour || ' * * *';
  v_evening_cron := v_evening_minute || ' ' || v_evening_utc_hour || ' * * *';
  
  -- قالب الأمر
  v_command_template := format(
    $cmd$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer %s'
      ),
      body := jsonb_build_object(
        'mode', 'comprehensive',
        'sync_invoices', true,
        'sync_orders', true,
        'force_refresh', false
      )
    ) AS request_id;
    $cmd$,
    v_supabase_url, v_anon_key
  );
  
  -- حذف الـ jobs القديمة
  BEGIN
    PERFORM cron.unschedule('smart-invoice-sync-morning');
    PERFORM cron.unschedule('smart-invoice-sync-evening');
    PERFORM cron.unschedule('invoice-sync-am');
    PERFORM cron.unschedule('invoice-sync-pm');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- إنشاء jobs جديدة
  PERFORM cron.schedule('smart-invoice-sync-morning', v_morning_cron, v_command_template);
  PERFORM cron.schedule('smart-invoice-sync-evening', v_evening_cron, v_command_template);
  
  -- تحديث جدول الإعدادات
  UPDATE auto_sync_schedule_settings
  SET 
    sync_times = ARRAY[p_morning_time, p_evening_time]::text[],
    updated_at = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  RETURN jsonb_build_object(
    'success', true,
    'morning_time_baghdad', p_morning_time,
    'evening_time_baghdad', p_evening_time,
    'morning_cron_utc', v_morning_cron,
    'evening_cron_utc', v_evening_cron,
    'url', v_supabase_url
  );
END;
$$;

-- الخطوة 4: تحديث الإعدادات المحفوظة
UPDATE auto_sync_schedule_settings
SET 
  sync_times = ARRAY['04:15', '21:00']::text[],
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.update_invoice_sync_schedule(TEXT, TEXT) TO authenticated;