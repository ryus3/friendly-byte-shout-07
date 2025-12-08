-- ============================================
-- نظام الأرباح الهرمي لمدراء الأقسام
-- ============================================

-- 1. إضافة عمود created_by لجدول employee_profit_rules لتتبع من أنشأ القاعدة
ALTER TABLE public.employee_profit_rules 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(user_id);

-- 2. إنشاء جدول قواعد أرباح مدراء الأقسام
CREATE TABLE IF NOT EXISTS public.department_manager_profit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_manager_id UUID NOT NULL REFERENCES public.profiles(user_id),
  product_id UUID REFERENCES public.products(id),
  category_id UUID REFERENCES public.categories(id),
  department_id UUID REFERENCES public.departments(id),
  profit_amount NUMERIC NOT NULL DEFAULT 0,
  profit_percentage NUMERIC DEFAULT 0,
  profit_type TEXT DEFAULT 'fixed' CHECK (profit_type IN ('fixed', 'percentage')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. تفعيل RLS
ALTER TABLE public.department_manager_profit_rules ENABLE ROW LEVEL SECURITY;

-- 4. سياسة القراءة: المدير العام يرى الكل، مدير القسم يرى قواعده فقط
CREATE POLICY "department_manager_profit_rules_select" 
ON public.department_manager_profit_rules 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON p.user_id = ur.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE p.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
  )
  OR department_manager_id = auth.uid()
);

-- 5. سياسة الإدراج: المدير العام فقط يستطيع إنشاء قواعد لمدراء الأقسام
CREATE POLICY "department_manager_profit_rules_insert" 
ON public.department_manager_profit_rules 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON p.user_id = ur.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE p.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
  )
);

-- 6. سياسة التعديل: المدير العام فقط
CREATE POLICY "department_manager_profit_rules_update" 
ON public.department_manager_profit_rules 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON p.user_id = ur.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE p.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
  )
);

-- 7. سياسة الحذف: المدير العام فقط
CREATE POLICY "department_manager_profit_rules_delete" 
ON public.department_manager_profit_rules 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON p.user_id = ur.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE p.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
  )
);

-- 8. تريجر لتحديث updated_at
CREATE OR REPLACE FUNCTION update_department_manager_profit_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_dept_manager_profit_rules_updated_at ON public.department_manager_profit_rules;
CREATE TRIGGER trg_update_dept_manager_profit_rules_updated_at
BEFORE UPDATE ON public.department_manager_profit_rules
FOR EACH ROW
EXECUTE FUNCTION update_department_manager_profit_rules_updated_at();

-- 9. إضافة صلاحية manage_purchases للمدير العام فقط (إذا لم تكن موجودة)
INSERT INTO public.permissions (name, display_name, category, description)
VALUES ('manage_purchases', 'إدارة المشتريات', 'purchases', 'الوصول الكامل لصفحة المشتريات')
ON CONFLICT (name) DO NOTHING;

-- 10. منح صلاحية manage_purchases لأدوار المدير العام
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('super_admin', 'admin')
AND p.name = 'manage_purchases'
ON CONFLICT DO NOTHING;