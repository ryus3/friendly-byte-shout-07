-- جدول الفترات المالية المغلقة
CREATE TABLE public.closed_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly, custom
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- الأرصدة
  opening_cash_balance NUMERIC NOT NULL DEFAULT 0,
  closing_cash_balance NUMERIC NOT NULL DEFAULT 0,
  
  -- الإيرادات
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_delivery_fees NUMERIC NOT NULL DEFAULT 0,
  sales_without_delivery NUMERIC NOT NULL DEFAULT 0,
  
  -- التكاليف والمصاريف
  total_cogs NUMERIC NOT NULL DEFAULT 0,
  total_general_expenses NUMERIC NOT NULL DEFAULT 0,
  total_employee_dues_paid NUMERIC NOT NULL DEFAULT 0,
  
  -- الأرباح
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  gross_profit_margin NUMERIC NOT NULL DEFAULT 0,
  net_profit_margin NUMERIC NOT NULL DEFAULT 0,
  
  -- إحصائيات الطلبات
  total_orders INTEGER NOT NULL DEFAULT 0,
  delivered_orders INTEGER NOT NULL DEFAULT 0,
  returned_orders INTEGER NOT NULL DEFAULT 0,
  
  -- إحصائيات الموظفين
  total_employee_profit NUMERIC NOT NULL DEFAULT 0,
  
  -- بيانات تفصيلية (JSON)
  summary_data JSONB DEFAULT '{}'::jsonb,
  
  -- حالة الإغلاق
  status TEXT NOT NULL DEFAULT 'open', -- open, closed, locked
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES auth.users(id),
  
  -- ملاحظات
  notes TEXT,
  
  -- تتبع
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.closed_periods ENABLE ROW LEVEL SECURITY;

-- المديرون فقط يديرون الفترات المغلقة
CREATE POLICY "المديرون يديرون الفترات المغلقة"
ON public.closed_periods
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- المستخدمون المصرح لهم يرون الفترات
CREATE POLICY "المستخدمون يرون الفترات المغلقة"
ON public.closed_periods
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_closed_periods_updated_at
BEFORE UPDATE ON public.closed_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index للبحث السريع
CREATE INDEX idx_closed_periods_dates ON public.closed_periods(start_date, end_date);
CREATE INDEX idx_closed_periods_status ON public.closed_periods(status);

-- منع تعديل الفترات المقفلة
CREATE OR REPLACE FUNCTION prevent_locked_period_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'locked' AND TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status OR 
       NEW.opening_cash_balance != OLD.opening_cash_balance OR
       NEW.closing_cash_balance != OLD.closing_cash_balance OR
       NEW.total_revenue != OLD.total_revenue OR
       NEW.net_profit != OLD.net_profit THEN
      RAISE EXCEPTION 'لا يمكن تعديل فترة مقفلة';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_period_modification
BEFORE UPDATE ON public.closed_periods
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_period_modification();