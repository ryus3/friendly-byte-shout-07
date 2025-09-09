-- إضافة حقل sales_amount لحفظ سعر المنتجات بعد الخصم (بدون رسوم التوصيل)
ALTER TABLE public.orders 
ADD COLUMN sales_amount NUMERIC;

-- تحديث الطلبات الموجودة لحساب sales_amount
-- sales_amount = total_amount - discount (بدون رسوم التوصيل)
UPDATE public.orders 
SET sales_amount = COALESCE(total_amount, 0) - COALESCE(discount, 0)
WHERE sales_amount IS NULL;

-- إضافة تعليق للحقل الجديد
COMMENT ON COLUMN public.orders.sales_amount IS 'مبلغ المبيعات بعد الخصم (بدون رسوم التوصيل) للحسابات المحاسبية';