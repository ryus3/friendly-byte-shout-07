-- حل جذري نهائي: تصحيح مباشر للطلب 112552848 فقط
UPDATE orders
SET 
  final_amount = 61000,
  total_amount = 56000,
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM orders 
  WHERE tracking_number = '112552848' 
  AND order_type = 'partial_delivery'
);

-- التحقق النهائي من الطلبين
SELECT 
  tracking_number,
  CASE 
    WHEN tracking_number = '112552848' AND final_amount = 61000 THEN '✅ تم التصحيح'
    WHEN tracking_number = '112066293' AND final_amount = 33000 THEN '✅ صحيح'
    ELSE '❌ خطأ'
  END as status,
  final_amount as "المبلغ النهائي",
  total_amount as "سعر المنتجات",
  discount,
  order_type,
  receipt_received as "استلام الفاتورة"
FROM orders
WHERE tracking_number IN ('112552848', '112066293')
ORDER BY tracking_number;