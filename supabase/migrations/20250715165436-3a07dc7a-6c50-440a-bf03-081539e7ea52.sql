-- فقط تفعيل REPLICA IDENTITY للجداول التي تحتاجه
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;