-- إنشاء جدول قواعد الأرباح المخصصة
CREATE TABLE public.employee_profit_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('product', 'category', 'department')),
  target_id UUID NOT NULL,
  profit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  profit_percentage NUMERIC(5,2) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, rule_type, target_id)
);

-- تمكين RLS
ALTER TABLE public.employee_profit_rules ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "المستخدمون المصرح لهم يمكنهم عرض قواعد الأرباح" 
ON public.employee_profit_rules 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "المستخدمون المصرح لهم يمكنهم إدارة قواعد الأرباح" 
ON public.employee_profit_rules 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- ترايجر لتحديث updated_at
CREATE TRIGGER update_employee_profit_rules_updated_at
  BEFORE UPDATE ON public.employee_profit_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- دالة لحساب ربح الموظف مع القواعد المخصصة (كل المعاملات لها قيم افتراضية)
CREATE OR REPLACE FUNCTION public.calculate_employee_profit(
  p_employee_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_selling_price NUMERIC,
  p_cost_price NUMERIC,
  p_category_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  custom_profit NUMERIC := 0;
  default_profit NUMERIC := 0;
  profit_rule RECORD;
BEGIN
  -- البحث عن قاعدة مخصصة للمنتج
  SELECT * INTO profit_rule 
  FROM public.employee_profit_rules 
  WHERE employee_id = p_employee_id 
    AND rule_type = 'product' 
    AND target_id = p_product_id 
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- استخدام القاعدة المخصصة للمنتج
    IF profit_rule.profit_amount > 0 THEN
      RETURN profit_rule.profit_amount * p_quantity;
    ELSIF profit_rule.profit_percentage > 0 THEN
      RETURN (p_selling_price * profit_rule.profit_percentage / 100) * p_quantity;
    END IF;
  END IF;
  
  -- البحث عن قاعدة مخصصة للفئة
  IF p_category_id IS NOT NULL THEN
    SELECT * INTO profit_rule 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'category' 
      AND target_id = p_category_id 
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      IF profit_rule.profit_amount > 0 THEN
        RETURN profit_rule.profit_amount * p_quantity;
      ELSIF profit_rule.profit_percentage > 0 THEN
        RETURN (p_selling_price * profit_rule.profit_percentage / 100) * p_quantity;
      END IF;
    END IF;
  END IF;
  
  -- البحث عن قاعدة مخصصة للقسم
  IF p_department_id IS NOT NULL THEN
    SELECT * INTO profit_rule 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'department' 
      AND target_id = p_department_id 
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      IF profit_rule.profit_amount > 0 THEN
        RETURN profit_rule.profit_amount * p_quantity;
      ELSIF profit_rule.profit_percentage > 0 THEN
        RETURN (p_selling_price * profit_rule.profit_percentage / 100) * p_quantity;
      END IF;
    END IF;
  END IF;
  
  -- استخدام الحساب الافتراضي
  default_profit := (p_selling_price - p_cost_price) * p_quantity;
  RETURN GREATEST(default_profit, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;