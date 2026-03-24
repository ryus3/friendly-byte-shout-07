DROP POLICY IF EXISTS "المديرون يديرون قواعد الأرباح" ON employee_profit_rules;
CREATE POLICY "المديرون يديرون قواعد الأرباح" ON employee_profit_rules
FOR ALL TO authenticated
USING (
  check_user_permission(auth.uid(), 'manage_profit_settlement')
  OR check_user_permission(auth.uid(), 'manage_all_data')
)
WITH CHECK (
  check_user_permission(auth.uid(), 'manage_profit_settlement')
  OR check_user_permission(auth.uid(), 'manage_all_data')
);