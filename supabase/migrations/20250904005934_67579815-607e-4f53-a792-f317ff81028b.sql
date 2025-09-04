-- إصلاح مشكلة receipt_received للطلبات المرتبطة بالفواتير المستلمة
-- تحديث مباشر دون استخدام triggers

-- أولاً: تعطيل triggers مؤقتاً
ALTER TABLE public.orders DISABLE TRIGGER ALL;

-- تحديث الطلبات المرتبطة بفواتير مستلمة
UPDATE public.orders 
SET 
  receipt_received = true,
  receipt_received_at = COALESCE(receipt_received_at, now()),
  receipt_received_by = COALESCE(receipt_received_by, created_by),
  updated_at = now()
WHERE id IN (
  SELECT DISTINCT dio.order_id
  FROM public.delivery_invoice_orders dio
  JOIN public.delivery_invoices di ON dio.invoice_id = di.id
  WHERE di.received = true 
  AND di.partner = 'alwaseet'
  AND dio.order_id IS NOT NULL
)
AND receipt_received = false
AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet';

-- تحديث خاص للطلب 98713588
UPDATE public.orders 
SET 
  receipt_received = true,
  receipt_received_at = COALESCE(receipt_received_at, now()),
  receipt_received_by = COALESCE(receipt_received_by, created_by),
  updated_at = now()
WHERE order_number = '98713588' 
AND receipt_received = false;

-- إعادة تفعيل triggers
ALTER TABLE public.orders ENABLE TRIGGER ALL;