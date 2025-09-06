-- Create employee smart sync log table to track last smart sync per employee
CREATE TABLE IF NOT EXISTS public.employee_smart_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  last_smart_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_invoice_date TIMESTAMP WITH TIME ZONE,
  invoices_synced INTEGER DEFAULT 0,
  sync_type TEXT DEFAULT 'smart',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.employee_smart_sync_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "المديرون يديرون سجلات المزامنة الذكية" 
ON public.employee_smart_sync_log 
FOR ALL 
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

CREATE POLICY "المستخدمون يرون سجلات مزامنتهم الذكية" 
ON public.employee_smart_sync_log 
FOR SELECT 
USING (employee_id = auth.uid() OR is_admin_or_deputy());

-- Add trigger for updated_at
CREATE TRIGGER update_employee_smart_sync_log_updated_at
  BEFORE UPDATE ON public.employee_smart_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();