-- إصلاح سياسات الأمان الخطيرة
-- 1. تحديث سياسات جدول العملاء لتكون أكثر أماناً
DROP POLICY IF EXISTS "المستخدمون يديرون العملاء" ON public.customers;
DROP POLICY IF EXISTS "المستخدمون يرون العملاء" ON public.customers;

CREATE POLICY "المديرون والمنشئون يديرون العملاء" 
ON public.customers FOR ALL 
USING (
  is_admin_or_deputy() OR 
  created_by = auth.uid() OR
  check_user_permission(auth.uid(), 'manage_all_customers')
);

-- 2. تحديث سياسات جدول الطلبات
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;

CREATE POLICY "المستخدمون يديرون طلباتهم والمديرون يديرون كل الطلبات" 
ON public.orders FOR ALL 
USING (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'view_all_orders')
);

-- 3. تحديث سياسات جدول الأرباح لتكون أكثر تقييداً
DROP POLICY IF EXISTS "Profits manageable by authenticated users" ON public.profits;
DROP POLICY IF EXISTS "Profits viewable by authenticated users" ON public.profits;

CREATE POLICY "الموظفون يرون أرباحهم والمديرون يديرون كل الأرباح" 
ON public.profits FOR SELECT 
USING (
  employee_id = auth.uid() OR 
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'view_all_profits')
);

CREATE POLICY "المديرون فقط يديرون الأرباح" 
ON public.profits FOR INSERT, UPDATE, DELETE 
USING (
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'manage_profits')
);

-- 4. تحديث سياسات المخزون لتكون أكثر أماناً
DROP POLICY IF EXISTS "Authenticated users can manage inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory;

CREATE POLICY "المستخدمون المصرح لهم يديرون المخزون" 
ON public.inventory FOR ALL 
USING (
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'manage_inventory') OR
  check_user_permission(auth.uid(), 'view_inventory')
);

-- 5. إنشاء دالة أمان للتحقق من الأدوار
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin', 'deputy_admin')
    AND ur.is_active = true
    AND r.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. تقوية سياسات الملفات الشخصية
DROP POLICY IF EXISTS "Safe admin access to profiles" ON public.profiles;

CREATE POLICY "أمان الملفات الشخصية المحسن" 
ON public.profiles FOR ALL 
USING (
  auth.uid() = user_id OR 
  is_admin_or_deputy()
)
WITH CHECK (
  auth.uid() = user_id OR 
  is_admin_or_deputy()
);