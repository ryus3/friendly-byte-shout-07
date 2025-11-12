-- جدول صلاحيات إرسال إشعارات WhatsApp للموظفين
CREATE TABLE IF NOT EXISTS employee_notification_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  can_send_whatsapp BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE employee_notification_permissions ENABLE ROW LEVEL SECURITY;

-- المدير يرى ويعدل الجميع
CREATE POLICY "Admins manage all notification permissions"
ON employee_notification_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('admin', 'super_admin')
    AND ur.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('admin', 'super_admin')
    AND ur.is_active = true
  )
);

-- الموظف يرى صلاحياته فقط
CREATE POLICY "Employees view own notification permissions"
ON employee_notification_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());