-- إنشاء جدول فواتير التسوية الموحد
CREATE TABLE IF NOT EXISTS public.settlement_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  settlement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID NOT NULL,
  order_ids TEXT[] DEFAULT '{}',
  settled_orders JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تمكين RLS
ALTER TABLE public.settlement_invoices ENABLE ROW LEVEL SECURITY;

-- إضافة سياسات الأمان
CREATE POLICY "المستخدمون المصرح لهم يديرون فواتير التسوية" 
ON public.settlement_invoices 
FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- إضافة trigger للـ updated_at
CREATE OR REPLACE FUNCTION public.update_settlement_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_settlement_invoices_updated_at
  BEFORE UPDATE ON public.settlement_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_settlement_invoices_updated_at();

-- ترحيل البيانات من notifications نوع settlement_invoice
INSERT INTO public.settlement_invoices (
  id,
  invoice_number,
  employee_id,
  employee_name,
  employee_code,
  total_amount,
  payment_method,
  settlement_date,
  generated_by,
  order_ids,
  settled_orders,
  notes,
  status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  COALESCE((data->>'invoice_number'), 'INV-' || id::text),
  COALESCE((data->>'employee_id')::uuid, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
  COALESCE((data->>'employee_name'), 'غير محدد'),
  (data->>'employee_code'),
  COALESCE((data->>'total_amount')::numeric, 0),
  COALESCE((data->>'payment_method'), 'cash'),
  COALESCE((data->>'generated_at')::timestamp with time zone, created_at),
  COALESCE((data->>'generated_by')::uuid, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
  COALESCE(
    CASE 
      WHEN jsonb_typeof(data->'order_ids') = 'array' 
      THEN ARRAY(SELECT jsonb_array_elements_text(data->'order_ids'))
      ELSE '{}'::text[]
    END,
    '{}'::text[]
  ),
  COALESCE((data->'settled_orders'), '[]'::jsonb),
  message,
  'completed',
  created_at,
  updated_at
FROM public.notifications 
WHERE type = 'settlement_invoice'
ON CONFLICT (invoice_number) DO NOTHING;

-- ترحيل البيانات من expenses (مستحقات الموظفين)
INSERT INTO public.settlement_invoices (
  id,
  invoice_number,
  employee_id,
  employee_name,
  employee_code,
  total_amount,
  payment_method,
  settlement_date,
  generated_by,
  order_ids,
  settled_orders,
  notes,
  status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  COALESCE(receipt_number, 'EXP-' || id::text),
  COALESCE((metadata->>'employee_id')::uuid, created_by),
  COALESCE((metadata->>'employee_name'), 'غير محدد'),
  (metadata->>'employee_code'),
  amount,
  COALESCE((metadata->>'payment_method'), 'cash'),
  COALESCE(approved_at, created_at),
  COALESCE(approved_by, created_by),
  COALESCE(
    CASE 
      WHEN jsonb_typeof(metadata->'order_ids') = 'array' 
      THEN ARRAY(SELECT jsonb_array_elements_text(metadata->'order_ids'))
      ELSE '{}'::text[]
    END,
    '{}'::text[]
  ),
  COALESCE((metadata->'settled_orders'), '[]'::jsonb),
  description,
  'completed',
  created_at,
  updated_at
FROM public.expenses 
WHERE expense_type = 'system' 
  AND category = 'مستحقات الموظفين'
  AND status = 'approved'
ON CONFLICT (invoice_number) DO NOTHING;

-- تحديث أسماء الموظفين من جدول profiles
UPDATE public.settlement_invoices 
SET employee_name = p.full_name,
    employee_code = p.employee_code
FROM public.profiles p 
WHERE settlement_invoices.employee_id = p.user_id
  AND (settlement_invoices.employee_name = 'غير محدد' OR settlement_invoices.employee_name IS NULL);