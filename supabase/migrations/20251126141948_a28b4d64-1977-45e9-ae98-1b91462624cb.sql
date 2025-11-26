-- تحديث مباشر بسيط جداً لجميع الطلبات
-- سنقوم بتحديث updated_at أيضاً لإجبار التحديث

UPDATE orders 
SET 
  final_amount = total_amount + COALESCE(delivery_fee, 0),
  updated_at = CURRENT_TIMESTAMP
WHERE discount > 0;

-- التحقق الفوري
SELECT 
  tracking_number,
  total_amount::numeric as total,
  delivery_fee::numeric as delivery,
  discount::numeric as disc,
  final_amount::numeric as final,
  (total_amount + delivery_fee)::numeric as should_be,
  CASE 
    WHEN final_amount = total_amount + delivery_fee THEN '✅ صحيح'
    ELSE '❌ خاطئ: ' || (final_amount - (total_amount + delivery_fee))::text
  END as status
FROM orders 
WHERE discount > 0
ORDER BY tracking_number;