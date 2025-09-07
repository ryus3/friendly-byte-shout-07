
-- Backfill: مزامنة أرباح الطلبات التي استلمت فاتورتها ولم تُحدّث أرباحها بعد
UPDATE public.profits p
SET status = 'invoice_received',
    updated_at = now()
FROM public.orders o
WHERE p.order_id = o.id
  AND o.receipt_received = true
  AND p.status NOT IN ('invoice_received', 'settled');

-- اختياري: يمكنك فحص عدد السجلات المتأثرة بعد التنفيذ عبر:
-- SELECT COUNT(*) 
-- FROM public.profits p JOIN public.orders o ON o.id = p.order_id
-- WHERE o.receipt_received = true AND p.status = 'invoice_received';
