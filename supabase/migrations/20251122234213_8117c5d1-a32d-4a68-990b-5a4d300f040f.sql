-- تصحيح final_amount و total_amount لجميع طلبات التسليم الجزئي الموجودة
UPDATE orders o
SET 
  final_amount = pdh.delivered_revenue,
  total_amount = pdh.delivered_revenue - COALESCE(pdh.delivery_fee_allocated, 0),
  updated_at = NOW()
FROM partial_delivery_history pdh
WHERE pdh.order_id = o.id
  AND o.order_type = 'partial_delivery'
  AND (
    o.final_amount IS DISTINCT FROM pdh.delivered_revenue 
    OR o.total_amount IS DISTINCT FROM (pdh.delivered_revenue - COALESCE(pdh.delivery_fee_allocated, 0))
  );

-- عرض النتائج للتأكيد
SELECT 
  tracking_number,
  '✅ تم التصحيح' as status,
  final_amount as "المبلغ النهائي",
  total_amount as "سعر المنتجات",
  discount,
  order_type
FROM orders
WHERE order_type = 'partial_delivery'
ORDER BY created_at DESC;