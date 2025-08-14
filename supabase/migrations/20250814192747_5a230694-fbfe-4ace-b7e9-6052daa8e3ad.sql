-- إصلاح سياسات الأمان مع تصحيح الأخطاء
-- 1. إنشاء دالة أمان للتحقق من الأدوار أولاً
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

-- 2. تحديث سياسات جدول العملاء
DROP POLICY IF EXISTS "المستخدمون يديرون العملاء" ON public.customers;
DROP POLICY IF EXISTS "المستخدمون يرون العملاء" ON public.customers;

CREATE POLICY "المديرون والمنشئون يديرون العملاء" 
ON public.customers FOR ALL 
USING (
  is_admin_or_deputy() OR 
  created_by = auth.uid() OR
  check_user_permission(auth.uid(), 'manage_all_customers')
);

-- 3. تحديث سياسات جدول الطلبات
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;

CREATE POLICY "المستخدمون يديرون طلباتهم والمديرون يديرون كل الطلبات" 
ON public.orders FOR ALL 
USING (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'view_all_orders')
);

-- 4. تحديث سياسات جدول الأرباح - SELECT منفصلة
DROP POLICY IF EXISTS "Profits manageable by authenticated users" ON public.profits;
DROP POLICY IF EXISTS "Profits viewable by authenticated users" ON public.profits;

CREATE POLICY "الموظفون يرون أرباحهم والمديرون يديرون كل الأرباح" 
ON public.profits FOR SELECT 
USING (
  employee_id = auth.uid() OR 
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'view_all_profits')
);

-- 5. سياسة منفصلة للتعديل والحذف للأرباح
CREATE POLICY "المديرون فقط يعدلون الأرباح" 
ON public.profits FOR UPDATE 
USING (
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'manage_profits')
);

CREATE POLICY "المديرون فقط يحذفون الأرباح" 
ON public.profits FOR DELETE 
USING (
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'manage_profits')
);

CREATE POLICY "المديرون فقط ينشئون الأرباح" 
ON public.profits FOR INSERT 
WITH CHECK (
  is_admin_or_deputy() OR
  check_user_permission(auth.uid(), 'manage_profits')
);