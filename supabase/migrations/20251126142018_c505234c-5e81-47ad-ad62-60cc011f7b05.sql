-- الحل النهائي: حذف الـ trigger القديم تماماً، تصحيح البيانات، إعادة إنشاء trigger صحيح

-- 1. حذف الـ trigger القديم تماماً
DROP TRIGGER IF EXISTS calculate_order_amounts_trigger ON orders;

-- 2. تحديث جميع الطلبات بالقيم الصحيحة (بدون trigger)
UPDATE orders 
SET final_amount = total_amount + COALESCE(delivery_fee, 0)
WHERE discount > 0;

-- 3. إعادة إنشاء الـ trigger بالمنطق الصحيح
CREATE TRIGGER calculate_order_amounts_trigger
  BEFORE INSERT OR UPDATE OF total_amount, delivery_fee
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_amounts();

COMMENT ON TRIGGER calculate_order_amounts_trigger ON orders IS 'يُنفذ فقط عند INSERT أو UPDATE على total_amount أو delivery_fee - لا يُنفذ عند UPDATE على discount';

-- 4. التحقق النهائي
SELECT 
  COUNT(*) FILTER (WHERE discount > 0) as total_with_discount,
  COUNT(*) FILTER (WHERE discount > 0 AND final_amount = total_amount + delivery_fee) as correct_amount,
  STRING_AGG(tracking_number, ', ') FILTER (WHERE discount > 0 AND final_amount != total_amount + delivery_fee) as still_incorrect
FROM orders;