-- إنشاء cron job للمزامنة التلقائية مرتين يومياً
-- تفعيل التمديدات المطلوبة أولاً (إذا لم تكن مفعلة)
SELECT cron.unschedule('daily-alwaseet-sync-morning');
SELECT cron.unschedule('daily-alwaseet-sync-evening');

-- مزامنة صباحية في الساعة 9:00
SELECT cron.schedule(
  'daily-alwaseet-sync-morning',
  '0 9 * * *', -- كل يوم في الساعة 9:00 صباحاً
  $$
  SELECT
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/daily-auto-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:='{"sync_time": "morning_auto", "scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- مزامنة مسائية في الساعة 21:00
SELECT cron.schedule(
  'daily-alwaseet-sync-evening',
  '0 21 * * *', -- كل يوم في الساعة 9:00 مساءً
  $$
  SELECT
    net.http_post(
        url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/daily-auto-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body:='{"sync_time": "evening_auto", "scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- إصلاح دالة للمزامنة الشاملة السريعة للطلبات
CREATE OR REPLACE FUNCTION public.sync_recent_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  updated_count INTEGER := 0;
  invoice_record RECORD;
BEGIN
  -- البحث عن الفواتير المستلمة حديثاً وتحديث الطلبات المرتبطة
  FOR invoice_record IN 
    SELECT id, external_id, owner_user_id
    FROM delivery_invoices 
    WHERE received = true 
      AND received_at > now() - interval '24 hours'
      AND partner = 'alwaseet'
  LOOP
    -- تحديث طلبات هذه الفاتورة
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, invoice_record.owner_user_id),
      delivery_partner_invoice_id = invoice_record.external_id::text,
      updated_at = now()
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = invoice_record.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;
    
    GET DIAGNOSTICS updated_count = updated_count + ROW_COUNT;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_count,
    'message', 'تم تحديث ' || updated_count || ' طلب من الفواتير المستلمة حديثاً'
  );
END;
$function$;