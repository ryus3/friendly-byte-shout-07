-- إضافة حقول المدينة والمحافظة لجدول ai_orders
ALTER TABLE public.ai_orders 
ADD COLUMN customer_city text,
ADD COLUMN customer_province text;