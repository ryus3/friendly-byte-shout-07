-- إعداد cron job للتنظيف اليومي
-- يعمل كل يوم في الساعة 2:00 صباحاً
SELECT cron.schedule(
  'daily-notifications-cleanup',
  '0 2 * * *',
  $$
  select
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/daily-notifications-cleanup',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);