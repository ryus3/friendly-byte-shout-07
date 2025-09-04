-- حذف جميع الفواتير إلا الأحدث (واحدة فقط)
WITH latest_invoice AS (
  SELECT id 
  FROM public.delivery_invoices 
  WHERE partner = 'alwaseet'
  ORDER BY 
    COALESCE(issued_at, last_api_updated_at, created_at) DESC NULLS LAST
  LIMIT 1
)
DELETE FROM public.delivery_invoice_orders 
WHERE invoice_id NOT IN (SELECT id FROM latest_invoice);

DELETE FROM public.delivery_invoices 
WHERE partner = 'alwaseet' 
AND id NOT IN (SELECT id FROM latest_invoice);

-- تحديث الفاتورة المتبقية لتكون ضمن النطاق الزمني الحالي للاختبار
UPDATE public.delivery_invoices 
SET issued_at = '2025-09-01 12:00:00+00'::timestamptz,
    created_at = '2025-09-01 12:00:00+00'::timestamptz
WHERE partner = 'alwaseet';