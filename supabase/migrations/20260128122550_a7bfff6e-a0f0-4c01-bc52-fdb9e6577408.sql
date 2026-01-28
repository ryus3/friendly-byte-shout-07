-- حذف كل الـ Cron Jobs الخاطئة والمكررة
DO $$
BEGIN
  -- حذف invoice-sync-am/pm (URL خاطئ)
  PERFORM cron.unschedule(59);
  PERFORM cron.unschedule(60);
  
  -- حذف smart-invoice-sync القديمة (الأوقات خاطئة 09:00 و 21:00 UTC)
  PERFORM cron.unschedule(17);
  PERFORM cron.unschedule(18);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;