-- Enable realtime for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Enable realtime for ai_orders table  
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;

-- Enable realtime for profiles table for user updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Enable realtime for inventory table for stock updates
ALTER TABLE public.inventory REPLICA IDENTITY FULL;

-- Enable realtime for orders table for order updates
ALTER TABLE public.orders REPLICA IDENTITY FULL;