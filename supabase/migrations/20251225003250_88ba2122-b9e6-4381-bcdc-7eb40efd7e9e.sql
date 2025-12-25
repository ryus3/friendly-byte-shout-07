-- نقل الطلبات التي ربح الموظف بها = 0 إلى أرشيف التسوية
UPDATE profits
SET 
  status = 'no_rule_archived',
  settled_at = NOW()
WHERE employee_profit = 0 
  AND status = 'invoice_received';