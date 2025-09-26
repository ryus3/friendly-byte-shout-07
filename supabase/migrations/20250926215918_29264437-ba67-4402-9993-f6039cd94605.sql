-- إعادة إنشاء trigger ووظيفة الإشعار للطلبات الذكية
-- إنشاء وظيفة تستدعي Edge Function عند إنشاء طلب ذكي جديد
CREATE OR REPLACE FUNCTION public.notify_ai_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_payload jsonb;
BEGIN
  -- تحضير البيانات للإرسال إلى Edge Function
  webhook_payload := jsonb_build_object(
    'type', 'ai_order_created',
    'record', jsonb_build_object(
      'id', NEW.id::text,
      'created_by', NEW.created_by,
      'customer_name', NEW.customer_name,
      'total_amount', NEW.total_amount,
      'source', NEW.source,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );

  -- استدعاء Edge Function باستخدام supabase client
  PERFORM net.http_post(
    url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/ai-order-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := webhook_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- في حالة فشل الإشعار، نسجل الخطأ ولكن لا نمنع إنشاء الطلب
  RAISE WARNING 'فشل في إرسال إشعار الطلب الذكي: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- إنشاء trigger على جدول ai_orders
CREATE TRIGGER ai_order_notification_trigger
  AFTER INSERT ON public.ai_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ai_order_created();

-- تفعيل http extension إذا لم تكن مفعلة
CREATE EXTENSION IF NOT EXISTS http;