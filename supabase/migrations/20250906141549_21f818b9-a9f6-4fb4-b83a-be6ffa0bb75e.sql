-- إنشاء جدولة cron للمزامنة التلقائية
-- إزالة أي جدولة موجودة أولاً 
DO $$
BEGIN
  -- محاولة إزالة الجدولة إذا كانت موجودة
  PERFORM cron.unschedule('daily-alwaseet-sync');
EXCEPTION 
  WHEN OTHERS THEN 
    NULL; -- تجاهل الخطأ إذا لم تكن موجودة
END $$;

-- إنشاء جدولة جديدة للمزامنة مرتين يومياً (9 صباحاً و 9 مساءً)
SELECT cron.schedule(
  'daily-alwaseet-sync',
  '0 9,21 * * *', -- كل يوم في الساعة 9 صباحاً و 9 مساءً
  $$
  SELECT
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/daily-auto-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:='{"sync_time": "auto_scheduled", "scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- تحديث إعدادات المزامنة لتفعيل المزامنة اليومية
UPDATE invoice_sync_settings 
SET daily_sync_enabled = true,
    sync_frequency = 'twice_daily',
    morning_sync_time = '09:00:00',
    evening_sync_time = '21:00:00',
    keep_invoices_per_employee = 10,
    updated_at = now()
WHERE id IS NOT NULL;

-- إنشاء سجل إذا لم توجد إعدادات
INSERT INTO invoice_sync_settings (
  daily_sync_enabled,
  sync_frequency,
  morning_sync_time,
  evening_sync_time,
  keep_invoices_per_employee
) 
SELECT true, 'twice_daily', '09:00:00', '21:00:00', 10
WHERE NOT EXISTS (SELECT 1 FROM invoice_sync_settings);