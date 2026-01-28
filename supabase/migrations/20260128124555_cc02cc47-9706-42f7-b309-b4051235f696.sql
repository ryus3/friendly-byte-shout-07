-- تحديث دالة get_invoice_cron_status لتعرض فقط الـ Jobs الصحيحة (61, 62)
CREATE OR REPLACE FUNCTION public.get_invoice_cron_status()
RETURNS TABLE (
  job_name TEXT,
  schedule TEXT,
  is_active BOOLEAN,
  next_run_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::text as job_name,
    j.schedule::text as schedule,
    j.active as is_active,
    CASE 
      WHEN j.active THEN NOW() + INTERVAL '1 hour'
      ELSE NULL
    END as next_run_at
  FROM cron.job j
  WHERE j.jobname IN (
    'smart-invoice-sync-morning', 
    'smart-invoice-sync-evening'
  )
  ORDER BY j.jobname;
END;
$$;