-- تصحيح البيانات الخاطئة: إعادة تعيين الخصم/الزيادة للطلبات التي لم يتغير سعرها
-- هذا التحديث يصحح الطلبات التي لديها خصم أو زيادة خاطئة بينما السعر الأصلي يساوي السعر الحالي

UPDATE orders o
SET 
  price_increase = 0,
  price_change_type = NULL,
  discount = 0,
  updated_at = now()
WHERE EXISTS (
  SELECT 1 
  FROM order_items oi
  WHERE oi.order_id = o.id
  GROUP BY oi.order_id
  HAVING SUM(oi.quantity * oi.unit_price) = o.total_amount
)
AND (o.price_increase > 0 OR o.discount > 0)
AND o.delivery_partner = 'alwaseet';

-- تسجيل عدد الطلبات المصححة
DO $$
DECLARE
  corrected_count integer;
BEGIN
  GET DIAGNOSTICS corrected_count = ROW_COUNT;
  RAISE NOTICE 'تم تصحيح % طلب لديه خصم/زيادة خاطئة', corrected_count;
END $$;