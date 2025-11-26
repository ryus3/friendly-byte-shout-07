-- إصلاح جذري: حذف trigger أولاً، تصحيح البيانات، ثم إعادة إنشاء trigger صحيح

-- 1. حذف الـ trigger القديم تماماً
DROP TRIGGER IF EXISTS calculate_order_amounts_trigger ON orders;

-- 2. حذف الدالة القديمة
DROP FUNCTION IF EXISTS calculate_order_amounts() CASCADE;

-- 3. تصحيح الطلب 112762972 (بدون trigger الآن)
UPDATE orders 
SET final_amount = 30000  -- total_amount (25000) + delivery_fee (5000) = 30000
WHERE tracking_number = '112762972';

-- 4. إنشاء الدالة الصحيحة الجديدة
CREATE OR REPLACE FUNCTION calculate_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- discount للعرض فقط - total_amount يأتي من شركة التوصيل بعد الخصم بالفعل
  -- final_amount = total_amount + delivery_fee (الخصم مُطبق مرة واحدة فقط)
  NEW.final_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0));
  NEW.sales_amount := GREATEST(0, COALESCE(NEW.total_amount, 0));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';

COMMENT ON FUNCTION calculate_order_amounts() IS 'CRITICAL: discount للعرض فقط - total_amount يحتوي بالفعل على السعر بعد الخصم';

-- 5. إعادة إنشاء الـ trigger الصحيح
CREATE TRIGGER calculate_order_amounts_trigger
  BEFORE INSERT OR UPDATE OF total_amount, delivery_fee
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_amounts();

-- 6. التحقق النهائي من الطلب
SELECT 
  tracking_number,
  total_amount as "المبلغ الأساسي",
  discount as "الخصم (للعرض)",
  delivery_fee as "رسوم التوصيل",
  final_amount as "المبلغ النهائي",
  CASE 
    WHEN final_amount = 30000 THEN '✅ صحيح'
    ELSE '❌ لا يزال خطأ: ' || final_amount::text
  END as "الحالة"
FROM orders 
WHERE tracking_number = '112762972';