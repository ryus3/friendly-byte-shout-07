-- إصلاح RLS policies لجدول employee_allowed_products

-- حذف السياسات القديمة إذا وجدت
DROP POLICY IF EXISTS "Employees can read their allowed products" ON employee_allowed_products;
DROP POLICY IF EXISTS "Public can read active allowed products" ON employee_allowed_products;
DROP POLICY IF EXISTS "Anyone can read active allowed products" ON employee_allowed_products;

-- إضافة سياسة للموظفين لقراءة منتجاتهم المسموحة
CREATE POLICY "Employees can read their allowed products"
ON employee_allowed_products FOR SELECT
USING (employee_id = auth.uid() OR is_admin_or_deputy());

-- إضافة سياسة عامة للقراءة في المتجر العام (anon users)
CREATE POLICY "Anyone can read active allowed products"
ON employee_allowed_products FOR SELECT
USING (is_active = true);

-- التأكد من وجود سياسات للمديرين للإدارة
DROP POLICY IF EXISTS "Admins can manage allowed products" ON employee_allowed_products;
CREATE POLICY "Admins can manage allowed products"
ON employee_allowed_products FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());