-- إصلاح نهائي: تصحيح جميع الطلبات المتأثرة بالخصم المزدوج (7 طلبات)

-- 1. تصحيح جميع الطلبات التي لديها خصم وأرقامها خاطئة
-- المنطق: total_amount بالفعل يحتوي السعر بعد الخصم
-- discount للعرض فقط - لا يُطبق مرة أخرى
UPDATE orders 
SET 
  final_amount = total_amount + COALESCE(delivery_fee, 0),
  sales_amount = total_amount
WHERE discount > 0 
  AND final_amount != (total_amount + COALESCE(delivery_fee, 0));

-- 2. التحقق من التصحيح - عرض الطلبات المصححة
DO $$
DECLARE
  corrected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO corrected_count
  FROM orders 
  WHERE discount > 0 
    AND final_amount = (total_amount + COALESCE(delivery_fee, 0));
  
  RAISE NOTICE '✅ تم تصحيح جميع الطلبات المتأثرة بالخصم المزدوج';
  RAISE NOTICE 'عدد الطلبات الصحيحة الآن: %', corrected_count;
END $$;

-- 3. عرض تفاصيل بعض الطلبات المصححة للتحقق
SELECT 
  tracking_number as "رقم التتبع",
  total_amount as "المبلغ الأساسي",
  discount as "الخصم (للعرض)",
  delivery_fee as "رسوم التوصيل",
  sales_amount as "مبلغ المبيعات",
  final_amount as "المبلغ النهائي",
  (total_amount + COALESCE(delivery_fee, 0)) as "المتوقع",
  CASE 
    WHEN final_amount = (total_amount + COALESCE(delivery_fee, 0)) THEN '✅ صحيح'
    ELSE '❌ خطأ'
  END as "الحالة"
FROM orders 
WHERE discount > 0
ORDER BY tracking_number DESC
LIMIT 10;