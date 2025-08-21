-- تفعيل Real-time للجداول المطلوبة
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;