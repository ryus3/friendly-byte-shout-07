-- حذف الكرون القديمة بالأسماء
DO $$
BEGIN
  PERFORM cron.unschedule('smart-invoice-sync-morning');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('smart-invoice-sync-evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;