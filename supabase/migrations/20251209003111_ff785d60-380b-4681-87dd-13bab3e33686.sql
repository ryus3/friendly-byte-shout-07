-- إصلاح search_path للدالة المضافة مع حذف التريجر أولاً
DROP TRIGGER IF EXISTS trg_update_dept_manager_profit_rules_updated_at ON public.department_manager_profit_rules;
DROP FUNCTION IF EXISTS update_department_manager_profit_rules_updated_at();

CREATE OR REPLACE FUNCTION public.update_department_manager_profit_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_update_dept_manager_profit_rules_updated_at
BEFORE UPDATE ON public.department_manager_profit_rules
FOR EACH ROW
EXECUTE FUNCTION update_department_manager_profit_rules_updated_at();