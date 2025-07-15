-- حذف كامل للبيانات لبداية نظيفة
DELETE FROM public.order_items;
DELETE FROM public.orders; 
DELETE FROM public.ai_orders;
DELETE FROM public.profits;
DELETE FROM public.notifications WHERE type IN ('order_status_update', 'new_order', 'ai_order');

-- إعادة تعيين المخزون المحجوز
UPDATE public.inventory SET reserved_quantity = 0;