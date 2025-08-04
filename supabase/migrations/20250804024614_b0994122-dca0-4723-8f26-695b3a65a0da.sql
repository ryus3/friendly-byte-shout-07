-- تحديث سياسات الأمان لجدول customer_phone_loyalty لتسمح للجميع برؤية البيانات
DROP POLICY IF EXISTS "المستخدمون يديرون ولاء عملائهم حس" ON customer_phone_loyalty;

-- سياسة جديدة للسماح لجميع المستخدمين المصرح لهم برؤية وإدارة البيانات
CREATE POLICY "المستخدمون المصرح لهم يديرون ولاء العملاء" 
ON customer_phone_loyalty 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);