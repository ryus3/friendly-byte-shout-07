-- حذف جميع الطلبات الموجودة (الطلبات العادية والذكية)
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.ai_orders;
DELETE FROM public.profits;

-- إعادة تعيين المخزون المحجوز إلى الصفر
UPDATE public.inventory SET reserved_quantity = 0;