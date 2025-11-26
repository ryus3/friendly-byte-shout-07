-- تصحيح مباشر لجميع الطلبات المتأثرة بالخصم المزدوج
-- تحديث بسيط بدون شروط معقدة

-- تعطيل الـ trigger مؤقتاً أثناء التصحيح
ALTER TABLE orders DISABLE TRIGGER calculate_order_amounts_trigger;

-- تصحيح جميع الطلبات التي لديها discount > 0 و final_amount خاطئ
UPDATE orders 
SET final_amount = total_amount + delivery_fee
WHERE discount > 0 
  AND final_amount < total_amount + delivery_fee;

-- إعادة تفعيل الـ trigger
ALTER TABLE orders ENABLE TRIGGER calculate_order_amounts_trigger;

-- التحقق من النتائج
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM orders 
  WHERE discount > 0 
    AND final_amount = total_amount + delivery_fee;
    
  RAISE NOTICE 'تم تصحيح الطلبات - عدد الطلبات الصحيحة الآن: %', fixed_count;
END $$;