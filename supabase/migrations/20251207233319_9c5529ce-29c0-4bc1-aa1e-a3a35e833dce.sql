-- إنشاء جدول ربط الموظفين بالمشرفين (مدراء الأقسام)
CREATE TABLE IF NOT EXISTS public.employee_supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(user_id),
  assigned_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(employee_id, supervisor_id)
);

-- إنشاء فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_employee_supervisors_employee ON public.employee_supervisors(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_supervisors_supervisor ON public.employee_supervisors(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_employee_supervisors_active ON public.employee_supervisors(is_active) WHERE is_active = true;

-- تفعيل RLS
ALTER TABLE public.employee_supervisors ENABLE ROW LEVEL SECURITY;

-- سياسة: المشرفون يمكنهم رؤية فريقهم والمدراء يرون الكل
CREATE POLICY "Supervisors can view their team"
ON public.employee_supervisors 
FOR SELECT
USING (
  supervisor_id = auth.uid() 
  OR is_admin_or_deputy()
);

-- سياسة: المدراء فقط يمكنهم إدارة المشرفين
CREATE POLICY "Admins can manage supervisors"
ON public.employee_supervisors 
FOR ALL
USING (is_admin_or_deputy());

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_employee_supervisors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_employee_supervisors_updated_at ON public.employee_supervisors;
CREATE TRIGGER trg_update_employee_supervisors_updated_at
  BEFORE UPDATE ON public.employee_supervisors
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_supervisors_updated_at();