-- إنشاء أرباح للطلبات المكتملة
INSERT INTO profits (order_id, employee_id, total_revenue, total_cost, profit_amount, employee_percentage, employee_profit, status)
SELECT
  o.id as order_id,
  o.created_by as employee_id,
  o.final_amount as total_revenue,
  COALESCE(o.final_amount * 0.6, 0) as total_cost,
  COALESCE(o.final_amount * 0.4, 0) as profit_amount,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = o.created_by 
      AND r.name = 'super_admin'
      AND ur.is_active = true
    ) THEN 100.0
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = o.created_by 
      AND r.name IN ('department_manager', 'admin')
      AND ur.is_active = true
    ) THEN 15.0
    ELSE 10.0
  END as employee_percentage,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = o.created_by 
      AND r.name = 'super_admin'
      AND ur.is_active = true
    ) THEN o.final_amount * 0.4
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = o.created_by 
      AND r.name IN ('department_manager', 'admin')
      AND ur.is_active = true
    ) THEN o.final_amount * 0.4 * 0.15
    ELSE o.final_amount * 0.4 * 0.10
  END as employee_profit,
  'pending' as status
FROM orders o
WHERE o.status = 'delivered'
AND NOT EXISTS (
  SELECT 1 FROM profits p WHERE p.order_id = o.id
);