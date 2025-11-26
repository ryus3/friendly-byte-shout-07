-- إصلاح جذري: Trigger كان يخصم discount مرتين من final_amount
-- المشكلة: total_amount يحتوي على السعر بعد الخصم، لكن الـ trigger كان يخصم discount مرة أخرى
-- الحل: final_amount = total_amount + delivery_fee (بدون خصم discount مرة ثانية)

-- 1. حذف الـ trigger القديم الخاطئ
DROP TRIGGER IF EXISTS calculate_order_amounts_trigger ON orders;

-- 2. تعديل دالة حساب الأسعار لإزالة الخصم المزدوج
CREATE OR REPLACE FUNCTION calculate_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ الصيغة الصحيحة: total_amount يحتوي على السعر بعد الخصم بالفعل
  -- discount حقل للعرض فقط - لا يُخصم مرة أخرى من final_amount
  NEW.final_amount := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. إعادة إنشاء الـ trigger بالمنطق الصحيح
CREATE TRIGGER calculate_order_amounts_trigger
  BEFORE INSERT OR UPDATE OF total_amount, delivery_fee, discount
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_amounts();

-- 4. تصحيح الطلب المحدد (112762972)
UPDATE orders 
SET final_amount = total_amount + delivery_fee,
    updated_at = now()
WHERE tracking_number = '112762972';

-- 5. تصحيح جميع الطلبات المتأثرة بالخصم المزدوج
-- البحث عن الطلبات التي لديها discount > 0 و final_amount يساوي (total_amount - discount + delivery_fee)
UPDATE orders 
SET final_amount = total_amount + delivery_fee,
    updated_at = now()
WHERE discount > 0 
  AND final_amount != total_amount + delivery_fee
  AND final_amount = total_amount - discount + delivery_fee;

COMMENT ON FUNCTION calculate_order_amounts() IS 'إصلاح جذري 2025-11-26: إزالة الخصم المزدوج - total_amount يحتوي على السعر بعد الخصم، discount للعرض فقط';