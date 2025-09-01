-- تحديث حالة الطلب لاختبار النظام الجديد
UPDATE public.orders 
SET delivery_status = '3', updated_at = now()
WHERE tracking_number = '100128890';