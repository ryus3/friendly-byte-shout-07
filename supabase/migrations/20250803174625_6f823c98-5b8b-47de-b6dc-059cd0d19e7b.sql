-- تحديث نقاط العملاء الحاليين حسب النظام الجديد (250 نقطة لكل طلب مكتمل)
UPDATE customer_loyalty 
SET 
  total_points = (
    SELECT COUNT(o.id) * 250
    FROM orders o 
    WHERE o.customer_id = customer_loyalty.customer_id
    AND o.status = 'completed'
    AND o.receipt_received = true
  ),
  updated_at = now()
WHERE customer_id IN (
  SELECT DISTINCT o.customer_id 
  FROM orders o 
  WHERE o.status = 'completed' 
  AND o.receipt_received = true
);

-- تحديث سجل تاريخ النقاط ليعكس النظام الجديد
DELETE FROM loyalty_points_history 
WHERE transaction_type = 'earned' 
AND description LIKE '%طلب مكتمل%';

-- إعادة إنشاء سجلات النقاط للطلبات المكتملة
INSERT INTO loyalty_points_history (
  customer_id, 
  order_id, 
  points_earned, 
  transaction_type, 
  description,
  created_at
)
SELECT 
  o.customer_id,
  o.id,
  250,
  'earned',
  'نقاط من طلب مكتمل - 250 نقطة ثابتة (تحديث النظام)',
  o.created_at
FROM orders o
WHERE o.status = 'completed' 
AND o.receipt_received = true
AND o.customer_id IS NOT NULL;