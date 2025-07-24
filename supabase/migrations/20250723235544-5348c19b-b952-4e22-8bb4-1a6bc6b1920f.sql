-- إنشاء جدول لسجل إرسال التقارير المجدولة
CREATE TABLE public.scheduled_reports_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_id UUID,
  report_type TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  telegram_sent BOOLEAN DEFAULT false,
  errors TEXT[],
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.scheduled_reports_log ENABLE ROW LEVEL SECURITY;

-- صلاحيات للمديرين فقط
CREATE POLICY "المديرون يديرون سجل التقارير المجدولة"
ON public.scheduled_reports_log
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
    AND ur.is_active = true
  )
);

-- إنشاء جدول للتقارير المجدولة
CREATE TABLE public.scheduled_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  enabled BOOLEAN DEFAULT true,
  email_to TEXT,
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_chat_id BIGINT,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- صلاحيات المستخدمين لإدارة تقاريرهم المجدولة
CREATE POLICY "المستخدمون يديرون تقاريرهم المجدولة"
ON public.scheduled_reports
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- صلاحيات المديرين لرؤية جميع التقارير المجدولة
CREATE POLICY "المديرون يرون جميع التقارير المجدولة"
ON public.scheduled_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
    AND ur.is_active = true
  )
);