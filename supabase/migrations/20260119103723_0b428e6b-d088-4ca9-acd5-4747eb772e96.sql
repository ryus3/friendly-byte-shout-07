-- 1. حذف جميع نسخ الدالة المتعددة
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(TIME, TIME);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(TEXT);

-- 2. إنشاء نسخة واحدة فقط تعمل مع الكرون الجديد
CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_morning_time TEXT DEFAULT '09:00',
  p_evening_time TEXT DEFAULT '21:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  v_morning_hour INT;
  v_morning_min INT;
  v_evening_hour INT;
  v_evening_min INT;
  v_morning_cron TEXT;
  v_evening_cron TEXT;
  v_morning_job_id BIGINT;
  v_evening_job_id BIGINT;
BEGIN
  -- Parse morning time
  v_morning_hour := SPLIT_PART(p_morning_time, ':', 1)::INT;
  v_morning_min := COALESCE(NULLIF(SPLIT_PART(p_morning_time, ':', 2), ''), '0')::INT;
  
  -- Parse evening time
  v_evening_hour := SPLIT_PART(p_evening_time, ':', 1)::INT;
  v_evening_min := COALESCE(NULLIF(SPLIT_PART(p_evening_time, ':', 2), ''), '0')::INT;
  
  -- Create cron expressions (Baghdad time = UTC+3)
  v_morning_cron := v_morning_min || ' ' || (v_morning_hour - 3) || ' * * *';
  v_evening_cron := v_evening_min || ' ' || (v_evening_hour - 3) || ' * * *';
  
  -- Find existing job IDs
  SELECT jobid INTO v_morning_job_id FROM cron.job WHERE jobname = 'invoice-sync-am';
  SELECT jobid INTO v_evening_job_id FROM cron.job WHERE jobname = 'invoice-sync-pm';
  
  -- Update morning job
  IF v_morning_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_morning_job_id, schedule := v_morning_cron);
  END IF;
  
  -- Update evening job
  IF v_evening_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_evening_job_id, schedule := v_evening_cron);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'morning_time', p_morning_time,
    'evening_time', p_evening_time,
    'morning_cron', v_morning_cron,
    'evening_cron', v_evening_cron,
    'morning_job_updated', v_morning_job_id IS NOT NULL,
    'evening_job_updated', v_evening_job_id IS NOT NULL
  );
END;
$$;

-- 3. تصحيح جميع قيم status_normalized لتكون lowercase
UPDATE delivery_invoices 
SET status_normalized = LOWER(status_normalized)
WHERE status_normalized IS NOT NULL AND status_normalized != LOWER(status_normalized);

-- 4. إنشاء trigger للتأكد من حفظ القيم بـ lowercase دائماً
CREATE OR REPLACE FUNCTION public.normalize_invoice_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_normalized IS NOT NULL THEN
    NEW.status_normalized := LOWER(NEW.status_normalized);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_invoice_status ON delivery_invoices;
CREATE TRIGGER trg_normalize_invoice_status
  BEFORE INSERT OR UPDATE ON delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_invoice_status_trigger();