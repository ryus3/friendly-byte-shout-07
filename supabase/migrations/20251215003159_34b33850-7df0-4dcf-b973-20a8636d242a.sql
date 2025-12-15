-- إنشاء جدول notification_reads لتتبع حالة القراءة لكل مستخدم بشكل منفصل
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- تفعيل RLS
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدمون يديرون قراءاتهم فقط
CREATE POLICY "Users manage their own notification reads"
ON public.notification_reads
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- فهرس للأداء
CREATE INDEX idx_notification_reads_user_id ON public.notification_reads(user_id);
CREATE INDEX idx_notification_reads_notification_id ON public.notification_reads(notification_id);

-- إصلاح فروقات المخزون
SELECT fix_inventory_discrepancies();