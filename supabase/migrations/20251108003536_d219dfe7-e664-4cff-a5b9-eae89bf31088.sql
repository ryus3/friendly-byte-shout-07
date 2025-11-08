-- جدول لإعدادات المزامنة التلقائية
CREATE TABLE IF NOT EXISTS auto_sync_schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  sync_times TEXT[] NOT NULL DEFAULT ARRAY['06:00', '12:00', '18:00', '23:00'],
  timezone TEXT NOT NULL DEFAULT 'Asia/Baghdad',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE auto_sync_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto sync schedule"
  ON auto_sync_schedule_settings
  FOR ALL
  USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

CREATE POLICY "Authenticated can view auto sync schedule"
  ON auto_sync_schedule_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- إدراج الإعدادات الافتراضية
INSERT INTO auto_sync_schedule_settings (enabled, sync_times, notifications_enabled)
VALUES (true, ARRAY['06:00', '12:00', '18:00', '23:00'], false)
ON CONFLICT DO NOTHING;