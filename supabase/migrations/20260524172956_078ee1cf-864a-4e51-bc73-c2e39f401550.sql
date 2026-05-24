
-- جدول بث تقدم المزامنة الشاملة
CREATE TABLE IF NOT EXISTS public.sync_progress_events (
  run_id uuid PRIMARY KEY,
  stage text NOT NULL DEFAULT 'init',
  stage_index integer NOT NULL DEFAULT 0,
  total_stages integer NOT NULL DEFAULT 5,
  percentage integer NOT NULL DEFAULT 0,
  message text,
  status text NOT NULL DEFAULT 'running', -- running|completed|failed|cancelled
  invoices_synced integer NOT NULL DEFAULT 0,
  orders_updated integer NOT NULL DEFAULT 0,
  linked_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  triggered_by uuid
);

ALTER TABLE public.sync_progress_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read sync progress" ON public.sync_progress_events;
CREATE POLICY "Authenticated can read sync progress"
ON public.sync_progress_events FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert sync progress" ON public.sync_progress_events;
CREATE POLICY "Authenticated can insert sync progress"
ON public.sync_progress_events FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update sync progress" ON public.sync_progress_events;
CREATE POLICY "Authenticated can update sync progress"
ON public.sync_progress_events FOR UPDATE
TO authenticated USING (true);

-- realtime
ALTER TABLE public.sync_progress_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sync_progress_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_progress_events';
  END IF;
END$$;

-- تنظيف تلقائي بعد 24 ساعة
CREATE INDEX IF NOT EXISTS idx_sync_progress_started ON public.sync_progress_events(started_at DESC);
