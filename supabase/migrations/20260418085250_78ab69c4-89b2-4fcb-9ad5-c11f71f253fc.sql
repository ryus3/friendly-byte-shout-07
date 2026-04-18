
-- ✅ السماح لمدير القسم برؤية قواعد أرباح موظفيه المُشرف عليهم
CREATE POLICY "مديرو الأقسام يرون قواعد أرباح موظفيهم"
ON public.employee_profit_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employee_supervisors es
    WHERE es.supervisor_id = auth.uid()
      AND es.employee_id = employee_profit_rules.employee_id
      AND es.is_active = true
  )
  OR check_user_permission(auth.uid(), 'manage_profit_settlement'::text)
  OR check_user_permission(auth.uid(), 'manage_all_data'::text)
);
