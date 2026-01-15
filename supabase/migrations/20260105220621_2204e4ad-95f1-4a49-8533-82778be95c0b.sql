-- حذف الـ jobs القديمة (ignore errors if not exist)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-sync-invoices-morning');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-sync-invoices-evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('invoices-daily-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-alwaseet-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;