-- تفعيل Real-time على جدول ai_orders
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;

-- إضافة الجدول إلى النشر المباشر
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_orders;