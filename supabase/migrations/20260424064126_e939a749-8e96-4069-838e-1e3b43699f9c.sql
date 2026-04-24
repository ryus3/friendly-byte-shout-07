-- إصلاح بقايا الكارثة: إلغاء أرشفة 12 طلب وإعادة profits إلى pending للفاتورة 3247172

-- 1) إزالة الأرشفة الخاطئة
UPDATE public.orders 
SET isarchived = false, updated_at = now()
WHERE delivery_partner_invoice_id = '3247172'
  AND status = 'delivered'
  AND receipt_received = false
  AND isarchived = true;

-- 2) إعادة profits إلى pending (مسح settled_at الكاذب)
UPDATE public.profits
SET status = 'pending', settled_at = NULL, updated_at = now()
WHERE order_id IN (
  SELECT id FROM public.orders 
  WHERE delivery_partner_invoice_id = '3247172'
    AND receipt_received = false
)
AND settled_at = '2026-04-24 06:20:51.230773+00'::timestamptz;