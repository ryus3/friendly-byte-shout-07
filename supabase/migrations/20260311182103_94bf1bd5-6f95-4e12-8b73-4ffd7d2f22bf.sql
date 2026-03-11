INSERT INTO profits (order_id, employee_id, employee_profit, total_revenue, total_cost, profit_amount, employee_percentage, status, settled_at)
SELECT 
  o.id,
  o.created_by,
  0,
  0,
  0,
  0,
  0,
  'no_rule_archived',
  NOW()
FROM orders o
LEFT JOIN profits p ON p.order_id = o.id
WHERE p.id IS NULL
  AND o.delivery_status = '4'
  AND o.receipt_received = true
  AND o.created_by != '91484496-b887-44f7-9e5d-be9db5567604'
ON CONFLICT DO NOTHING;