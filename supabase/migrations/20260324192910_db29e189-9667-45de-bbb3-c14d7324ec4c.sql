-- 1. BEFORE INSERT trigger: ضبط status='approved' تلقائياً للمصاريف التشغيلية
CREATE OR REPLACE FUNCTION auto_approve_operational_expense()
RETURNS trigger AS $$
BEGIN
  IF NEW.expense_type IS DISTINCT FROM 'system' AND NEW.category IS DISTINCT FROM 'مستحقات الموظفين' THEN
    NEW.status := 'approved';
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.approved_by := COALESCE(NEW.approved_by, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_approve_expense
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_operational_expense();

-- 2. إعادة ربط AFTER trigger لإنشاء حركة النقد (كان مفقوداً!)
CREATE TRIGGER trg_handle_expense_cash_movement
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION handle_expense_cash_movement();