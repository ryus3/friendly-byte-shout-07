-- تحديث أجور التوصيل للطلب ORD000013
UPDATE public.orders
SET delivery_fee = 5000,
    updated_at = now()
WHERE order_number = 'ORD000013';