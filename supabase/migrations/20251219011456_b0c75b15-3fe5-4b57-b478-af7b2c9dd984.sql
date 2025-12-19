-- إصلاح إدارة العملاء: كل مستخدم يرى عملاءه فقط بغض النظر عن صلاحياته

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Customers: select own or admins" ON customers;
DROP POLICY IF EXISTS "Customers: update own or admins" ON customers;
DROP POLICY IF EXISTS "Customers: delete own or admins" ON customers;
DROP POLICY IF EXISTS "المديرون والمنشئون يديرون العملاء" ON customers;
DROP POLICY IF EXISTS "Users see own customers only" ON customers;
DROP POLICY IF EXISTS "Users update own customers only" ON customers;
DROP POLICY IF EXISTS "Users delete own customers only" ON customers;
DROP POLICY IF EXISTS "Users insert own customers" ON customers;

-- سياسة القراءة: كل مستخدم يرى عملاءه فقط
CREATE POLICY "Users see own customers only" ON customers
FOR SELECT 
TO authenticated
USING (created_by = auth.uid());

-- سياسة الإضافة: كل مستخدم يضيف عملاءه فقط
CREATE POLICY "Users insert own customers" ON customers
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid());

-- سياسة التحديث: كل مستخدم يحدث عملاءه فقط
CREATE POLICY "Users update own customers only" ON customers
FOR UPDATE 
TO authenticated
USING (created_by = auth.uid()) 
WITH CHECK (created_by = auth.uid());

-- سياسة الحذف: كل مستخدم يحذف عملاءه فقط
CREATE POLICY "Users delete own customers only" ON customers
FOR DELETE 
TO authenticated
USING (created_by = auth.uid());