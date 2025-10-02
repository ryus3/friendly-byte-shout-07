-- إنشاء جدول لحفظ حالات الأزرار التفاعلية
CREATE TABLE IF NOT EXISTS public.telegram_pending_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

-- إنشاء index لتسريع البحث بـ chat_id
CREATE INDEX idx_telegram_pending_selections_chat_id ON public.telegram_pending_selections(chat_id);

-- إنشاء index لحذف الحالات المنتهية
CREATE INDEX idx_telegram_pending_selections_expires_at ON public.telegram_pending_selections(expires_at);

-- تفعيل RLS
ALTER TABLE public.telegram_pending_selections ENABLE ROW LEVEL SECURITY;

-- سياسة للسماح بجميع العمليات (الجدول للاستخدام الداخلي من edge function)
CREATE POLICY "Allow all operations on telegram_pending_selections"
  ON public.telegram_pending_selections
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- دالة لحذف الحالات المنتهية تلقائياً
CREATE OR REPLACE FUNCTION public.cleanup_expired_telegram_selections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.telegram_pending_selections
  WHERE expires_at < now();
END;
$$;