
-- ✅ تحديث دالة التناقضات لإزالة "unlinked_invoice_orders" كخطأ
-- هذه طلبات من شركة التوصيل مباشرة وليست من موقعكم

CREATE OR REPLACE FUNCTION public.get_invoice_discrepancies()
RETURNS TABLE (
  discrepancy_type text,
  count bigint,
  details text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- التناقض 1: طلبات مرتبطة بفواتير مستلمة لكن لم تُعلَّم
  SELECT 
    'orders_not_marked_received'::text as discrepancy_type,
    COUNT(*)::bigint as count,
    'طلبات مرتبطة بفواتير مستلمة لكن receipt_received=false'::text as details
  FROM orders o
  INNER JOIN delivery_invoice_orders dio ON dio.order_id = o.id
  INNER JOIN delivery_invoices di ON di.id = dio.invoice_id
  WHERE di.received = true AND (o.receipt_received = false OR o.receipt_received IS NULL)
  
  UNION ALL
  
  -- التناقض 2: فواتير بحالة "تاجر" لكن received=false
  SELECT 
    'invoices_status_mismatch'::text as discrepancy_type,
    COUNT(*)::bigint as count,
    'فواتير بحالة "التاجر" لكن received=false'::text as details
  FROM delivery_invoices
  WHERE (status LIKE '%التاجر%' OR status LIKE '%تاجر%') 
    AND (received = false OR received IS NULL);
  
  -- ✅ تم إزالة unlinked_invoice_orders لأنها ليست تناقضات حقيقية
  -- هذه طلبات تم إنشاؤها مباشرة في شركة التوصيل وليس في موقعكم
$$;
