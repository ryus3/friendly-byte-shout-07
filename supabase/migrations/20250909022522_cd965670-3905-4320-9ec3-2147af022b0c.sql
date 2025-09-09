-- Create employee_smart_sync_log table for tracking smart sync per employee
CREATE TABLE IF NOT EXISTS public.employee_smart_sync_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_smart_sync_at TIMESTAMP WITH TIME ZONE,
    last_invoice_date TIMESTAMP WITH TIME ZONE,
    invoices_synced INTEGER DEFAULT 0,
    sync_type TEXT DEFAULT 'smart', -- 'smart', 'comprehensive'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_employee_sync_log UNIQUE (employee_id)
);

-- Enable RLS
ALTER TABLE public.employee_smart_sync_log ENABLE ROW LEVEL SECURITY;

-- Create policies for employee sync log
CREATE POLICY "Users can view their own sync log" 
ON public.employee_smart_sync_log 
FOR SELECT 
USING (auth.uid() = employee_id OR is_admin_or_deputy());

CREATE POLICY "Users can update their own sync log" 
ON public.employee_smart_sync_log 
FOR ALL 
USING (auth.uid() = employee_id OR is_admin_or_deputy());

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_employee_smart_sync_log_employee_id 
ON public.employee_smart_sync_log(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_smart_sync_log_last_sync 
ON public.employee_smart_sync_log(last_smart_sync_at);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_smart_sync_log_updated_at
BEFORE UPDATE ON public.employee_smart_sync_log
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();