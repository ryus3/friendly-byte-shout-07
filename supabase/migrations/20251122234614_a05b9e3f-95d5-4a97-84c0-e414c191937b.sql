-- تصحيح مباشر للطلبين بالأرقام الصحيحة
UPDATE orders
SET 
  final_amount = 61000,
  total_amount = 56000,
  updated_at = NOW()
WHERE tracking_number = '112552848';

UPDATE orders
SET 
  final_amount = 33000,
  total_amount = 28000,
  updated_at = NOW()
WHERE tracking_number = '112066293';

-- التحقق النهائي
SELECT 
  tracking_number,
  '✅ تم التصحيح النهائي' as status,
  final_amount as "المبلغ النهائي",
  total_amount as "سعر المنتجات",
  discount,
  order_type,
  receipt_received as "استلام الفاتورة"
FROM orders
WHERE tracking_number IN ('112552848', '112066293')
ORDER BY created_at DESC;