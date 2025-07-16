-- تحديث RLS policies لجدول employee_profit_rules لإصلاح مشاكل الصلاحيات

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "المستخدمون المصرح لهم يمكنهم إدار" ON employee_profit_rules;
DROP POLICY IF EXISTS "المستخدمون المصرح لهم يمكنهم عرض ق" ON employee_profit_rules;

-- إنشاء سياسات جديدة وواضحة
CREATE POLICY "allow_admins_full_access" ON employee_profit_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin' 
      AND profiles.is_active = true
    )
  );

CREATE POLICY "allow_employees_view_own_rules" ON employee_profit_rules
  FOR SELECT USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin' 
      AND profiles.is_active = true
    )
  );