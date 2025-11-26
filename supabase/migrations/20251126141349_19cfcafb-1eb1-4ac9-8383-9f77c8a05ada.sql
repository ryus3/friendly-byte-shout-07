-- تصحيح نهائي مباشر لجميع الطلبات المتأثرة
-- هذه المرة بدون أي شروط معقدة

-- تعطيل الـ trigger مؤقتاً
ALTER TABLE orders DISABLE TRIGGER calculate_order_amounts_trigger;

-- تحديث مباشر لجميع الطلبات التي لديها discount > 0
UPDATE orders 
SET 
  final_amount = total_amount + COALESCE(delivery_fee, 0),
  updated_at = now()
WHERE discount > 0;

-- إعادة تفعيل الـ trigger
ALTER TABLE orders ENABLE TRIGGER calculate_order_amounts_trigger;

-- التحقق الفوري من النتائج
SELECT 
  'تم التصحيح' as result,
  COUNT(*) as total_fixed,
  SUM(CASE WHEN final_amount = total_amount + delivery_fee THEN 1 ELSE 0 END) as now_correct
FROM orders 
WHERE discount > 0;