-- حذف الـ triggers والـ functions الإشكالية بالترتيب الصحيح
-- يجب حذف الـ trigger أولاً ثم الـ function

-- حذف trigger طلبات AI
DROP TRIGGER IF EXISTS on_ai_order_created ON ai_orders;
DROP TRIGGER IF EXISTS ai_order_notification_trigger ON ai_orders;

-- حذف trigger تحديثات التوصيل
DROP TRIGGER IF EXISTS on_delivery_status_changed ON orders;

-- الآن يمكننا حذف الـ functions بأمان
DROP FUNCTION IF EXISTS notify_ai_order_created();
DROP FUNCTION IF EXISTS notify_delivery_status_changed();

-- إعادة إنشاء الـ function الأصلي الذي يعمل عبر Edge Function
CREATE OR REPLACE FUNCTION public.notify_ai_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_payload jsonb;
BEGIN
  webhook_payload := jsonb_build_object(
    'type', 'ai_order_created',
    'record', jsonb_build_object(
      'id', NEW.id,
      'created_by', NEW.processed_by,
      'customer_name', NEW.customer_name,
      'total_amount', NEW.total_amount,
      'source', NEW.source
    )
  );

  PERFORM net.http_post(
    url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/ai-order-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := webhook_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'فشل في إرسال إشعار الطلب الذكي: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- إنشاء trigger جديد
CREATE TRIGGER ai_order_notification_trigger
  AFTER INSERT ON public.ai_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ai_order_created();