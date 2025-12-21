-- الإصلاح المحدد: تعديل trigger + إصلاح 3 طلبات فقط

-- 1️⃣ تعديل الـ trigger ليعمل على status و delivery_status معاً
DROP TRIGGER IF EXISTS trigger_auto_create_profit_record ON orders;

CREATE TRIGGER trigger_auto_create_profit_record 
  AFTER UPDATE OF status, delivery_status ON public.orders 
  FOR EACH ROW 
  EXECUTE FUNCTION auto_create_profit_record();

-- 2️⃣ إنشاء سجلات أرباح للـ 3 طلبات المتأثرة فقط
-- هذه الطلبات لها order_items وقواعد ربح لكن لم يُنشأ لها سجل
INSERT INTO profits (
  employee_id, 
  order_id, 
  total_revenue, 
  total_cost, 
  profit_amount, 
  employee_percentage, 
  employee_profit, 
  status, 
  created_at, 
  updated_at
)
SELECT 
  o.created_by,
  o.id,
  COALESCE(o.final_amount, o.total_amount, 0),
  COALESCE((
    SELECT SUM(COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity)
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = o.id
  ), 0),
  COALESCE(o.final_amount, o.total_amount, 0) - COALESCE((
    SELECT SUM(COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity)
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = o.id
  ), 0),
  0, -- employee_percentage
  COALESCE((
    SELECT SUM(COALESCE(epr.profit_amount, 0) * oi.quantity)
    FROM order_items oi
    LEFT JOIN employee_profit_rules epr ON epr.employee_id = o.created_by 
      AND epr.is_active = true 
      AND (
        (epr.rule_type = 'product' AND epr.target_id = oi.product_id::text)
        OR (epr.rule_type = 'variant' AND epr.target_id = oi.variant_id::text)
      )
    WHERE oi.order_id = o.id
  ), 0),
  CASE WHEN o.receipt_received THEN 'invoice_received' ELSE 'pending' END,
  NOW(),
  NOW()
FROM orders o
WHERE o.order_number IN ('ORD000348', 'ORD000353', 'ORD000354')
  AND NOT EXISTS (SELECT 1 FROM profits p WHERE p.order_id = o.id);

-- 3️⃣ إرجاع هذه الطلبات الـ 3 إلى delivered (فقط إذا كان لها ربح موظف > 0)
UPDATE orders o
SET 
  status = 'delivered', 
  updated_at = NOW()
FROM profits p
WHERE p.order_id = o.id
  AND o.order_number IN ('ORD000348', 'ORD000353', 'ORD000354')
  AND o.status = 'completed'
  AND p.employee_profit > 0
  AND p.status NOT IN ('settled', 'no_rule_settled');