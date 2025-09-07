-- إضافة إعدادات المزامنة للطلبات والفواتير في صفحة متابعة الطلبات
ALTER TABLE invoice_sync_settings 
ADD COLUMN IF NOT EXISTS orders_sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS orders_sync_every_hours INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS orders_visible_only BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_invoices_daily_sync BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_invoices_sync_time TIME DEFAULT '09:00:00';

-- إنشاء جدول سجلات المزامنة للخلفية
CREATE TABLE IF NOT EXISTS background_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  invoices_synced INTEGER DEFAULT 0,
  orders_updated INTEGER DEFAULT 0,
  sync_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تطبيق RLS على جدول السجلات
ALTER TABLE background_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المديرون يديرون سجلات المزامنة في الخلفية" 
ON background_sync_logs 
FOR ALL 
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- دالة لإدارة cron jobs بناءً على الإعدادات
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

  -- إلغاء جميع الـ cron jobs الموجودة أولاً
  PERFORM cron.unschedule('background-sync-job');
  PERFORM cron.unschedule('orders-sync-job');
  PERFORM cron.unschedule('invoices-daily-sync');

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
  END IF;

  RAISE NOTICE 'تم إعداد cron jobs للمزامنة بنجاح';
END;
$$;

-- trigger لتحديث cron jobs عند تغيير الإعدادات
CREATE OR REPLACE FUNCTION update_sync_cron_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM manage_background_sync_cron();
  RETURN NEW;
END;
$$;

-- إنشاء trigger للإعدادات
DROP TRIGGER IF EXISTS sync_settings_cron_update ON invoice_sync_settings;
CREATE TRIGGER sync_settings_cron_update
  AFTER INSERT OR UPDATE ON invoice_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_cron_trigger();