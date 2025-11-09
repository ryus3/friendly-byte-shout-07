-- إلغاء الوظيفة الحالية التي تعمل كل ساعة
SELECT cron.unschedule('sync-order-updates-hourly');

-- إنشاء دالة جديدة لفحص وتشغيل المزامنة حسب الأوقات المحددة
CREATE OR REPLACE FUNCTION check_and_run_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_record RECORD;
  current_time_text TEXT;
  should_run BOOLEAN := false;
BEGIN
  -- جلب الإعدادات
  SELECT * INTO settings_record 
  FROM auto_sync_schedule_settings 
  LIMIT 1;
  
  -- التحقق من أن المزامنة مفعلة
  IF NOT settings_record.enabled THEN
    RAISE NOTICE 'المزامنة التلقائية معطلة';
    RETURN;
  END IF;
  
  -- الحصول على الوقت الحالي بصيغة HH:MM
  current_time_text := TO_CHAR(NOW(), 'HH24:MI');
  
  -- فحص إذا كان الوقت الحالي يطابق أحد الأوقات المحددة
  IF settings_record.sync_times @> ARRAY[current_time_text]::TEXT[] THEN
    should_run := true;
  END IF;
  
  -- تشغيل المزامنة إذا كان الوقت مناسباً
  IF should_run THEN
    RAISE NOTICE 'تشغيل المزامنة في الوقت المحدد: %', current_time_text;
    
    PERFORM net.http_post(
      url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-order-updates',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
      body := '{}'::jsonb
    );
  ELSE
    RAISE NOTICE 'الوقت الحالي % لا يطابق الأوقات المحددة', current_time_text;
  END IF;
END;
$$;

-- جدولة الدالة للعمل كل دقيقة (سيتم فحص الوقت داخلياً)
SELECT cron.schedule(
  'sync-order-updates-scheduled',
  '* * * * *', -- كل دقيقة
  'SELECT check_and_run_sync();'
);