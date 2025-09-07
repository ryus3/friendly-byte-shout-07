-- تنظيف وإعادة تشغيل نظام cron jobs للمزامنة التلقائية

-- إلغاء جميع cron jobs القديمة التي قد تسبب تضارب
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
  'background-sync-job',
  'orders-sync-job', 
  'invoices-daily-sync',
  'smart-invoice-sync',
  'auto-sync-invoices',
  'sync-delivery-invoices',
  'cleanup-notifications'
);

-- تطبيق الإعدادات الجديدة للمزامنة
SELECT manage_background_sync_cron();

-- إضافة cron job لتنظيف الإشعارات يومياً
SELECT cron.schedule(
  'daily-notifications-cleanup',
  '0 2 * * *', -- يومياً الساعة 2:00 صباحاً
  'SELECT daily_notifications_cleanup();'
);