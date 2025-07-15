-- تفعيل Real-time للجداول المطلوبة
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- إضافة الجداول إلى publication الخاص بـ Real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;