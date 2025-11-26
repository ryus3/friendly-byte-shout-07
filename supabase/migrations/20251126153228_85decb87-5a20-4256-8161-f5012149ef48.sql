-- إصلاح جذري نهائي: تعطيل كل الـ triggers وتصحيح البيانات

-- 1. حفظ البيانات قبل التعديل للمقارنة
CREATE TEMP TABLE orders_before_fix AS
SELECT tracking_number, total_amount, discount, delivery_fee, sales_amount, final_amount
FROM orders 
WHERE discount > 0;

-- 2. تعطيل جميع الـ triggers بشكل كامل على مستوى session
SET session_replication_role = 'replica';

-- 3. تصحيح البيانات مباشرة
UPDATE orders 
SET 
  final_amount = total_amount + COALESCE(delivery_fee, 0),
  sales_amount = total_amount
WHERE discount > 0;

-- 4. إعادة تفعيل الـ triggers
SET session_replication_role = 'origin';

-- 5. مقارنة البيانات قبل وبعد
SELECT 
  b.tracking_number as "رقم التتبع",
  b.final_amount as "قبل",
  o.final_amount as "بعد",
  (o.total_amount + COALESCE(o.delivery_fee, 0)) as "المتوقع",
  CASE 
    WHEN o.final_amount = (o.total_amount + COALESCE(o.delivery_fee, 0)) THEN '✅ تم الإصلاح'
    ELSE '❌ لا يزال خطأ'
  END as "الحالة"
FROM orders_before_fix b
JOIN orders o ON b.tracking_number = o.tracking_number
ORDER BY b.tracking_number DESC;