-- إنشاء webhook لتشغيل Edge Function عند إدراج طلب ذكي جديد
CREATE OR REPLACE FUNCTION notify_ai_order_webhook()
RETURNS trigger AS $$
BEGIN
  -- استدعاء Edge Function عبر HTTP request
  PERFORM
    net.http_post(
      url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/ai-order-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1MTg1MSwiZXhwIjoyMDY3OTI3ODUxfQ.HZ9FdXAZrQOWS2_s7Ao6xUOxoGM9FCZJ0fgTEIwGHGI"}'::jsonb,
      body := jsonb_build_object(
        'type', 'ai_order_created',
        'record', row_to_json(NEW),
        'table', 'ai_orders',
        'schema', 'public'
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;