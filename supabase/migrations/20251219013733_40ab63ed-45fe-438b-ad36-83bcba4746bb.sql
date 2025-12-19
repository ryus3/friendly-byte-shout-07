-- إصلاح RLS لجدول customer_phone_loyalty: كل مستخدم يرى عملاءه فقط

-- حذف السياسة المتساهلة التي تسمح للجميع برؤية كل البيانات
DROP POLICY IF EXISTS "المستخدمون المصرح لهم يديرون ولاء" ON customer_phone_loyalty;

-- حذف السياسات القديمة الأخرى لإعادة إنشائها بشكل صحيح
DROP POLICY IF EXISTS "users_insert_own_customers" ON customer_phone_loyalty;
DROP POLICY IF EXISTS "users_select_own_customers" ON customer_phone_loyalty;
DROP POLICY IF EXISTS "users_update_own_customers" ON customer_phone_loyalty;

-- سياسة القراءة: كل مستخدم يرى عملاءه فقط
CREATE POLICY "users_select_own_phone_loyalty"
ON customer_phone_loyalty
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- سياسة الإضافة: كل مستخدم يضيف عملاءه فقط
CREATE POLICY "users_insert_own_phone_loyalty"
ON customer_phone_loyalty
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- سياسة التحديث: كل مستخدم يحدث عملاءه فقط
CREATE POLICY "users_update_own_phone_loyalty"
ON customer_phone_loyalty
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- سياسة الحذف: كل مستخدم يحذف عملاءه فقط
CREATE POLICY "users_delete_own_phone_loyalty"
ON customer_phone_loyalty
FOR DELETE
TO authenticated
USING (created_by = auth.uid());