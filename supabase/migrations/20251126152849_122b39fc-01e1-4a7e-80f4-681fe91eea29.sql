-- إصلاح حاسم: تعطيل trigger مؤقتاً وتصحيح البيانات مباشرة

-- 1. تعطيل الـ triggers مؤقتاً
ALTER TABLE orders DISABLE TRIGGER normalize_order_amounts_trigger;
ALTER TABLE orders DISABLE TRIGGER calculate_order_amounts_trigger;

-- 2. تصحيح جميع الطلبات المتأثرة مباشرة
UPDATE orders 
SET 
  final_amount = total_amount + COALESCE(delivery_fee, 0),
  sales_amount = total_amount
WHERE discount > 0;

-- 3. إعادة تفعيل الـ triggers
ALTER TABLE orders ENABLE TRIGGER normalize_order_amounts_trigger;
ALTER TABLE orders ENABLE TRIGGER calculate_order_amounts_trigger;

-- 4. التحقق النهائي من التصحيح
SELECT 
  tracking_number as "رقم التتبع",
  total_amount as "المبلغ الأساسي",
  discount as "الخصم",
  delivery_fee as "التوصيل",
  sales_amount as "المبيعات",
  final_amount as "النهائي",
  (total_amount + COALESCE(delivery_fee, 0)) as "المتوقع",
  CASE 
    WHEN final_amount = (total_amount + COALESCE(delivery_fee, 0)) THEN '✅'
    ELSE '❌'
  END as "حالة"
FROM orders 
WHERE discount > 0
ORDER BY tracking_number DESC;