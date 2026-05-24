
-- 1) إعادة جدولة sync-order-updates-scheduled من كل دقيقة إلى كل 30 دقيقة (08:00-20:00)
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sync-order-updates-scheduled';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'sync-order-updates-scheduled',
  '*/30 8-20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-order-updates',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
    body := jsonb_build_object('source','cron','scope_mode','global')
  );
  $$
);

-- 2) إصلاح الطلب 143934088: استعادة المبلغ النهائي 25,000 وتسجيل الزيادة 1,000
UPDATE public.orders
SET 
  final_amount    = 25000,
  price_increase  = 1000,
  discount        = 0,
  price_change_type = 'increase',
  updated_at      = now()
WHERE id = 'dab3eeba-5b93-4e8d-a8d4-316808e2193f';
