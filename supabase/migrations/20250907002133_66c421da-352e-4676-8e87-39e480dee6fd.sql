-- إضافة cron job للمزامنة التلقائية في الخلفية كل 5 دقائق
SELECT cron.schedule(
    'background-sync-job',
    '*/5 * * * *', -- كل 5 دقائق
    $$
    SELECT
        net.http_post(
            url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/background-sync',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
            body:=concat('{"time": "', now(), '"}')::jsonb
        ) as request_id;
    $$
);