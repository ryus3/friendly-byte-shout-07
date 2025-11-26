-- إصلاح الطلب 112762972 فقط + إصلاح trigger لمنع الأخطاء المستقبلية

-- 1. تصحيح الطلب 112762972 المحدد فقط
UPDATE orders 
SET final_amount = 30000  -- total_amount (27000) + delivery_fee (3000)
WHERE tracking_number = '112762972';

-- 2. إصلاح دالة calculate_order_amounts لتعامل صحيح مع discount
DROP FUNCTION IF EXISTS calculate_order_amounts() CASCADE;

CREATE OR REPLACE FUNCTION calculate_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- discount للعرض فقط - total_amount يأتي من شركة التوصيل بعد الخصم
  -- final_amount = total_amount + delivery_fee (بدون خصم إضافي)
  NEW.final_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0));
  
  -- sales_amount = total_amount (بدون خصم إضافي)
  NEW.sales_amount := GREATEST(0, COALESCE(NEW.total_amount, 0));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';

COMMENT ON FUNCTION calculate_order_amounts() IS 'حساب المبالغ الصحيحة - discount للعرض فقط، total_amount يأتي بعد الخصم';

-- 3. إعادة إنشاء trigger
CREATE TRIGGER calculate_order_amounts_trigger
  BEFORE INSERT OR UPDATE OF total_amount, delivery_fee
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_amounts();

-- 4. التحقق من الطلب المصلح
SELECT 
  tracking_number,
  total_amount,
  discount,
  delivery_fee,
  final_amount,
  CASE 
    WHEN final_amount = total_amount + delivery_fee THEN '✅ صحيح'
    ELSE '❌ خطأ'
  END as status
FROM orders 
WHERE tracking_number = '112762972';