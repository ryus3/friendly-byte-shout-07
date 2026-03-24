ALTER TABLE employee_profit_rules DROP CONSTRAINT IF EXISTS employee_profit_rules_rule_type_check;
ALTER TABLE employee_profit_rules ADD CONSTRAINT employee_profit_rules_rule_type_check 
  CHECK (rule_type IN ('product', 'category', 'department', 'default', 'variant', 'product_type'));