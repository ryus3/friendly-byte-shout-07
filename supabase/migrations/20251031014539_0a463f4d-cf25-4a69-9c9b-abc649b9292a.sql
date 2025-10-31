-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing sync-order-updates cron jobs
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid FROM cron.job WHERE jobname LIKE '%sync-order-updates%' OR jobname LIKE '%sync%order%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

-- Create new cron job to sync order updates every hour
SELECT cron.schedule(
  'sync-order-updates-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-order-updates',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);