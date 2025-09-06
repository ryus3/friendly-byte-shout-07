-- إضافة إعدادات المزامنة التلقائية الموحدة الجديدة
ALTER TABLE public.invoice_sync_settings 
ADD COLUMN IF NOT EXISTS invoice_auto_sync BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invoice_daily_sync BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS orders_auto_sync BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS orders_twice_daily BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS orders_morning_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS orders_evening_time TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS sync_only_visible_orders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_work_hours_only BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS work_start_hour INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS work_end_hour INTEGER DEFAULT 20;

-- تحديث الإعدادات الحالية مع القيم الافتراضية الذكية (إذا كان هناك سجل موجود)
UPDATE public.invoice_sync_settings 
SET 
  invoice_auto_sync = COALESCE(invoice_auto_sync, true),
  invoice_daily_sync = COALESCE(invoice_daily_sync, true),
  orders_auto_sync = COALESCE(orders_auto_sync, true),
  orders_twice_daily = COALESCE(orders_twice_daily, true),
  orders_morning_time = COALESCE(orders_morning_time, '09:00:00'::time),
  orders_evening_time = COALESCE(orders_evening_time, '18:00:00'::time),
  sync_only_visible_orders = COALESCE(sync_only_visible_orders, true),
  sync_work_hours_only = COALESCE(sync_work_hours_only, true),
  work_start_hour = COALESCE(work_start_hour, 8),
  work_end_hour = COALESCE(work_end_hour, 20);

-- إنشاء سجل إعدادات افتراضي إذا لم يكن موجوداً (بدون تحديد ID صريح)
INSERT INTO public.invoice_sync_settings (
  daily_sync_enabled, 
  daily_sync_time, 
  lookback_days, 
  auto_cleanup_enabled, 
  keep_invoices_per_employee,
  invoice_auto_sync,
  invoice_daily_sync,
  orders_auto_sync,
  orders_twice_daily,
  orders_morning_time,
  orders_evening_time,
  sync_only_visible_orders,
  sync_work_hours_only,
  work_start_hour,
  work_end_hour
) 
SELECT 
  true,
  '09:00:00'::time,
  30,
  true,
  10,
  true,
  true,
  true,
  true,
  '09:00:00'::time,
  '18:00:00'::time,
  true,
  true,
  8,
  20
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_sync_settings LIMIT 1);