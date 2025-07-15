-- إضافة عمود استلام الفاتورة للطلبات
ALTER TABLE public.orders 
ADD COLUMN receipt_received BOOLEAN DEFAULT FALSE;

-- إضافة عمود تاريخ استلام الفاتورة
ALTER TABLE public.orders 
ADD COLUMN receipt_received_at TIMESTAMP WITH TIME ZONE;

-- إضافة عمود الموظف الذي استلم الفاتورة
ALTER TABLE public.orders 
ADD COLUMN receipt_received_by UUID REFERENCES public.profiles(user_id);