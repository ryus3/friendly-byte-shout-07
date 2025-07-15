-- حذف جميع الطلبات والبيانات المرتبطة بها لبداية نظيفة
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.ai_orders;
DELETE FROM public.profits;

-- حذف الإشعارات المتعلقة بالطلبات
DELETE FROM public.notifications WHERE type IN ('order_status_update', 'new_order', 'ai_order');

-- إعادة تعيين المخزون المحجوز
UPDATE public.inventory SET reserved_quantity = 0;