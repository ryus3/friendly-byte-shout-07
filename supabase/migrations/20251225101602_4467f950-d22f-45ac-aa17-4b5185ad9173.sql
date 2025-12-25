-- تحديث طلبات سارة أحمد (28 طلب) مع employee_profit = 0 و status = 'pending' إلى 'no_rule_archived'
UPDATE profits 
SET 
  status = 'no_rule_archived',
  settled_at = NOW()
WHERE employee_profit = 0 
  AND status = 'pending'
  AND employee_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0';

-- أيضاً تحديث جميع الطلبات الأخرى للموظفين الآخرين بنفس الحالة
UPDATE profits 
SET 
  status = 'no_rule_archived',
  settled_at = NOW()
WHERE employee_profit = 0 
  AND status = 'pending';