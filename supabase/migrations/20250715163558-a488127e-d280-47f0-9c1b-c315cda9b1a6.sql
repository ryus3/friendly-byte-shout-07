-- Enable real-time publications for all important tables
-- First, add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Ensure all tables have proper replica identity
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;