-- إعداد pg_cron للمزامنة اليومية التلقائية
SELECT cron.schedule(
  'daily-invoice-sync',
  '0 9 * * *', -- كل يوم في الساعة 9 صباحاً (سيتم تحديثه حسب الإعدادات)
  $$
  SELECT
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-alwaseet-invoices',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);