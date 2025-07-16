-- إصلاح قيد المفتاح الخارجي لاستلام الفواتير
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_receipt_received_by_fkey;

-- إعادة إضافة القيد مع الرجوع إلى user_id في profiles بدلاً من id
ALTER TABLE public.orders 
ADD CONSTRAINT orders_receipt_received_by_fkey 
FOREIGN KEY (receipt_received_by) REFERENCES public.profiles(user_id);