
-- Create cron job for token renewal (runs every 6 hours)
-- The SECURITY DEFINER function schedules it without needing manual UPDATE
CREATE OR REPLACE FUNCTION public.manage_token_renewal_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  _sql TEXT;
BEGIN
  -- Remove existing job if any
  BEGIN
    PERFORM cron.unschedule('refresh-delivery-tokens-daily');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  _sql := E'SELECT net.http_post(url := \'https://tkheostkubborwkwzugl.supabase.co/functions/v1/refresh-delivery-partner-tokens\', headers := \'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}\'::jsonb, body := \'{}\'::jsonb) AS request_id;';

  PERFORM cron.schedule('refresh-delivery-tokens-daily', '0 */6 * * *', _sql);
END;
$func$;

SELECT public.manage_token_renewal_cron();
