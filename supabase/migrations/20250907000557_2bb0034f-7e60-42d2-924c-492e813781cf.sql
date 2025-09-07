-- إنشاء جدول لتسجيل عمليات المزامنة في الخلفية
CREATE TABLE IF NOT EXISTS public.background_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'invoices', 'orders', 'both', 'none'
  invoices_synced INTEGER DEFAULT 0,
  orders_updated INTEGER DEFAULT 0,
  sync_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_background_sync_logs_sync_time ON public.background_sync_logs(sync_time DESC);
CREATE INDEX IF NOT EXISTS idx_background_sync_logs_sync_type ON public.background_sync_logs(sync_type);

-- تفعيل pg_cron إذا لم يكن مفعل
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- إنشاء cron job للمزامنة التلقائية كل 5 دقائق
SELECT cron.schedule(
  'background-sync-every-5-minutes',
  '*/5 * * * *', -- كل 5 دقائق
  $$
  SELECT
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/background-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- تنظيف السجلات القديمة (الاحتفاظ بآخر 30 يوم فقط)
SELECT cron.schedule(
  'cleanup-background-sync-logs',
  '0 2 * * *', -- يومياً في الساعة 2 صباحاً
  $$
  DELETE FROM public.background_sync_logs 
  WHERE created_at < now() - interval '30 days';
  $$
);