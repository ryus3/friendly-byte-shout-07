-- إضافة جدول notification_templates لتخصيص نصوص الإشعارات
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT UNIQUE NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- المديرون يديرون النماذج
CREATE POLICY "المديرون يديرون نماذج الإشعارات"
  ON notification_templates
  FOR ALL
  USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

-- الجميع يرون النماذج
CREATE POLICY "الجميع يرون نماذج الإشعارات"
  ON notification_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- إدراج النماذج الافتراضية
INSERT INTO notification_templates (type, title_template, body_template) VALUES
  ('ai_order', '🤖 طلب تليجرام جديد', 'طلب #{order_id} من {customer_name}'),
  ('delivery_update', '📦 تحديث حالة الطلب', 'الطلب #{order_number} - {status_text}'),
  ('new_registration', '👥 موظف جديد', 'انضم {employee_name} للفريق'),
  ('order_created', '📦 طلب جديد', 'طلب #{order_number} من {customer_name}')
ON CONFLICT (type) DO NOTHING;

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_templates_updated_at();