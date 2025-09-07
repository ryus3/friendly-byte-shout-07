-- تحديث دالة إدارة cron jobs لتجنب الأخطاء
CREATE OR REPLACE FUNCTION manage_background_sync_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  settings RECORD;
BEGIN
  -- جلب الإعدادات الحالية
  SELECT * INTO settings FROM invoice_sync_settings LIMIT 1;
  
  IF settings IS NULL THEN
    RAISE NOTICE 'لا توجد إعدادات مزامنة';
    RETURN;
  END IF;

  -- إلغاء جميع الـ cron jobs الموجودة أولاً (مع تجاهل الأخطاء)
  BEGIN
    PERFORM cron.unschedule('background-sync-job');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- تجاهل الخطأ إذا كان job غير موجود
  END;
  
  BEGIN
    PERFORM cron.unschedule('orders-sync-job');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- تجاهل الخطأ إذا كان job غير موجود
  END;
  
  BEGIN
    PERFORM cron.unschedule('invoices-daily-sync');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- تجاهل الخطأ إذا كان job غير موجود
  END;

  -- إنشاء cron job للطلبات (كل X ساعات)
  IF settings.orders_sync_enabled THEN
    PERFORM cron.schedule(
      'orders-sync-job',
      format('0 */%s %s-%s * * *', 
        settings.orders_sync_every_hours, 
        settings.work_start_hour, 
        settings.work_end_hour
      ),
      format('SELECT net.http_post(url:=''https://tkheostkubborwkwzugl.supabase.co/functions/v1/background-sync'', headers:=''{"Content-Type": "application/json"}''::jsonb, body:=''{"sync_type": "orders_tracking"}''::jsonb) as request_id;')
    );
    RAISE NOTICE 'تم إنشاء cron job للطلبات: كل % ساعات', settings.orders_sync_every_hours;
  END IF;

  -- إنشاء cron job للفواتير اليومية
  IF settings.delivery_invoices_daily_sync THEN
    PERFORM cron.schedule(
      'invoices-daily-sync',
      format('%s %s * * *', 
        EXTRACT(MINUTE FROM settings.delivery_invoices_sync_time),
        EXTRACT(HOUR FROM settings.delivery_invoices_sync_time)
      ),
      format('SELECT net.http_post(url:=''https://tkheostkubborwkwzugl.supabase.co/functions/v1/background-sync'', headers:=''{"Content-Type": "application/json"}''::jsonb, body:=''{"sync_type": "delivery_invoices"}''::jsonb) as request_id;')
    );
    RAISE NOTICE 'تم إنشاء cron job للفواتير: يومياً في %', settings.delivery_invoices_sync_time;
  END IF;

  RAISE NOTICE 'تم إعداد cron jobs للمزامنة بنجاح';
END;
$$;