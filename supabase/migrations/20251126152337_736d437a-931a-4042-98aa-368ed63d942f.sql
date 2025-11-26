-- إصلاح جذري نهائي: تصحيح دالة normalize_order_amounts الخاطئة

-- 1. حذف وإعادة إنشاء دالة normalize_order_amounts بالمنطق الصحيح
DROP FUNCTION IF EXISTS normalize_order_amounts() CASCADE;

CREATE OR REPLACE FUNCTION normalize_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ التسليم الجزئي: الأرقام تأتي من partial_delivery_history
  IF NEW.order_type = 'partial_delivery' THEN
    -- discount للعرض فقط - total_amount يحتوي السعر بعد الخصم
    NEW.sales_amount := GREATEST(0, COALESCE(NEW.total_amount, 0));
    NEW.final_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0));
    RETURN NEW;
  END IF;

  -- المنطق العادي - CRITICAL: discount للعرض فقط
  -- total_amount يأتي من شركة التوصيل بعد الخصم بالفعل
  NEW.total_amount := COALESCE(NEW.total_amount, 0);
  NEW.delivery_fee := COALESCE(NEW.delivery_fee, 0);
  NEW.discount := COALESCE(NEW.discount, 0);
  
  -- الخصم مُطبق مرة واحدة فقط في total_amount
  NEW.sales_amount := GREATEST(0, NEW.total_amount);
  NEW.final_amount := GREATEST(0, NEW.total_amount + NEW.delivery_fee);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp';

COMMENT ON FUNCTION normalize_order_amounts() IS 'CRITICAL: discount للعرض فقط - total_amount يحتوي بالفعل على السعر بعد الخصم';

-- 2. إعادة إنشاء الـ trigger
CREATE TRIGGER normalize_order_amounts_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION normalize_order_amounts();

-- 3. تصحيح الطلب 112762972 الآن
UPDATE orders 
SET total_amount = total_amount -- dummy update لتفعيل الـ trigger
WHERE tracking_number = '112762972';

-- 4. التحقق النهائي
SELECT 
  tracking_number,
  total_amount as "المبلغ الأساسي",
  discount as "الخصم (للعرض)",
  delivery_fee as "رسوم التوصيل",
  final_amount as "المبلغ النهائي",
  CASE 
    WHEN final_amount = 30000 THEN '✅ تم الإصلاح'
    ELSE '❌ لا يزال خطأ: ' || final_amount::text
  END as "الحالة"
FROM orders 
WHERE tracking_number = '112762972';