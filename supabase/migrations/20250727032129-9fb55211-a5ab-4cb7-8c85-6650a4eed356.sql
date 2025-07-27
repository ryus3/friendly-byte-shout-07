-- إضافة عمود created_by للعملاء لفصل عملاء كل موظف
-- هذا العمود موجود بالفعل لكن نحتاج لإنشاء نظام صلاحيات جديد

-- إنشاء صلاحيات جديدة لإدارة العملاء
INSERT INTO public.permissions (name, display_name, description, category) VALUES 
('manage_own_customers', 'إدارة العملاء الشخصيين', 'صلاحية إدارة العملاء الذين أنشأهم الموظف فقط', 'customer_management'),
('manage_all_customers', 'إدارة جميع العملاء', 'صلاحية إدارة جميع العملاء في النظام', 'customer_management');

-- تحديث سياسات الأمان للعملاء لفصل عملاء كل موظف
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;

-- سياسة جديدة: المديرون يرون جميع العملاء، الموظفون يرون عملاءهم فقط
CREATE POLICY "المديرون يرون جميع العملاء والموظفون يرون عملاءهم" 
ON public.customers 
FOR SELECT 
USING (
  check_user_permission(auth.uid(), 'manage_all_customers') OR 
  created_by = auth.uid()
);

-- سياسة جديدة: المديرون يديرون جميع العملاء، الموظفون يديرون عملاءهم فقط
CREATE POLICY "المديرون يديرون جميع العملاء والموظفون يديرون عملاءهم" 
ON public.customers 
FOR ALL 
USING (
  check_user_permission(auth.uid(), 'manage_all_customers') OR 
  created_by = auth.uid()
)
WITH CHECK (
  check_user_permission(auth.uid(), 'manage_all_customers') OR 
  created_by = auth.uid()
);

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);

-- تحديث سياسات ولاء العملاء أيضاً
DROP POLICY IF EXISTS "المستخدمون يديرون ولاء العملاء" ON public.customer_loyalty;

CREATE POLICY "المديرون يديرون جميع ولاء العملاء والموظفون ولاء عملاءهم" 
ON public.customer_loyalty 
FOR ALL 
USING (
  check_user_permission(auth.uid(), 'manage_all_customers') OR 
  EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_loyalty.customer_id 
    AND c.created_by = auth.uid()
  )
);