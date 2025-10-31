-- إضافة مزامنة تلقائية كل ساعة لطلبات AlWaseet
-- تستخدم pg_cron و pg_net لتشغيل edge function تلقائياً

-- 1. التأكد من تفعيل pg_cron و pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. إضافة مزامنة تلقائية كل ساعة (بدون حذف مسبق)
SELECT cron.schedule(
  'sync-alwaseet-orders-hourly',
  '0 * * * *', -- كل ساعة في الدقيقة 0
  $$
  SELECT
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-order-updates',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);