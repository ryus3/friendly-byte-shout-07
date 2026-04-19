-- 🛡️ تمكين REPLICA IDENTITY FULL لـ cities_regions_sync_log حتى تصل قيم cities_count و regions_count كاملة في Realtime UPDATE
ALTER TABLE public.cities_regions_sync_log REPLICA IDENTITY FULL;

-- ✅ التأكد من وجود الجدول في Realtime publication
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'cities_regions_sync_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cities_regions_sync_log;
  END IF;
END $$;

-- 🛡️ جدول جديد لتدقيق محاولات الحذف التلقائي قبل تنفيذها فعلياً
CREATE TABLE IF NOT EXISTS public.order_deletion_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  order_number text,
  tracking_number text,
  attempt_reason text NOT NULL,
  api_response_status text, -- 'confirmed_not_found' | 'api_error' | 'cf_blocked' | 'network_error'
  blocked_by_safety boolean DEFAULT false,
  block_reason text,
  attempted_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.order_deletion_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المديرون يرون كل المحاولات"
ON public.order_deletion_attempts FOR SELECT
USING (check_user_permission(auth.uid(), 'manage_all_data'));

CREATE POLICY "النظام يكتب المحاولات"
ON public.order_deletion_attempts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_order_deletion_attempts_created_at 
  ON public.order_deletion_attempts(created_at DESC);