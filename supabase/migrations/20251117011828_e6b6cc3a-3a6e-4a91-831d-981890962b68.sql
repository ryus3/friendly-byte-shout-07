
-- ✅ إصلاح السعر النهائي للطلب 112066293 ليطابق delivered_revenue
-- المشكلة: final_amount = 61000 (خطأ) يجب أن يكون 33000 (من partial_delivery_history)
UPDATE orders
SET 
  final_amount = 33000,
  updated_at = NOW()
WHERE tracking_number = '112066293'
  AND status = 'partial_delivery';

-- ✅ التحقق من النتيجة
SELECT 
  tracking_number,
  status,
  delivery_status,
  total_amount,
  final_amount,
  (SELECT delivered_revenue FROM partial_delivery_history WHERE order_id = orders.id) as correct_revenue
FROM orders
WHERE tracking_number = '112066293';
