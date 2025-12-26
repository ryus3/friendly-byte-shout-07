-- تحديث طلبات سارة المتبقية (3 طلبات) مع employee_profit = 0 و status = 'pending' إلى 'no_rule_archived'
UPDATE profits 
SET 
  status = 'no_rule_archived',
  settled_at = NOW()
WHERE employee_profit = 0 
  AND status = 'pending';