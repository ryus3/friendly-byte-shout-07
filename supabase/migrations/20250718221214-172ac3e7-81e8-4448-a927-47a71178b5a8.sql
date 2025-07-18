-- تفعيل Realtime للطلبات الذكية والإشعارات
ALTER TABLE IF EXISTS public.ai_orders REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;

-- إضافة الجداول إلى Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;