-- حذف جميع البيانات المتعلقة بالطلبات
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.ai_orders;
DELETE FROM public.profits;

-- حذف الإشعارات القديمة للمخزون والطلبات
DELETE FROM public.notifications WHERE type IN ('stock_alert', 'low_stock', 'order_status_update', 'new_order');

-- إعادة تعيين المخزون المحجوز
UPDATE public.inventory SET reserved_quantity = 0;

-- حذف تاريخ الإشعارات السابقة لبداية جديدة
DELETE FROM public.stock_notification_history;