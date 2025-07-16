-- تغيير نوع حقل target_id من UUID إلى TEXT لدعم القواعد العامة
ALTER TABLE employee_profit_rules ALTER COLUMN target_id TYPE TEXT;

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_employee_profit_rules_lookup ON employee_profit_rules(employee_id, rule_type, target_id);