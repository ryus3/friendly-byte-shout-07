-- إصلاح الـ webhook للطلبات الذكية مع استخدام المتغيرات الصحيحة
CREATE OR REPLACE FUNCTION public.notify_ai_order_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- استدعاء Edge Function عبر HTTP request مع استخدام متغيرات البيئة
  PERFORM
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ai-order-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'ai_order_created',
        'record', row_to_json(NEW),
        'table', 'ai_orders',
        'schema', 'public'
      )
    );
  
  RETURN NEW;
END;
$function$;