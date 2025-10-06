-- ===================================================================
-- المرحلة 1: جداول تتبع التقدم للمزامنة الذكية
-- ===================================================================

-- جدول تتبع تقدم المزامنة في الخلفية
CREATE TABLE IF NOT EXISTS public.background_sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL DEFAULT 'cities_regions',
  total_cities INTEGER NOT NULL DEFAULT 0,
  completed_cities INTEGER NOT NULL DEFAULT 0,
  total_regions INTEGER NOT NULL DEFAULT 0,
  completed_regions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_city_name TEXT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_background_sync_progress_status ON public.background_sync_progress(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_background_sync_progress_triggered_by ON public.background_sync_progress(triggered_by, started_at DESC);

-- تفعيل RLS
ALTER TABLE public.background_sync_progress ENABLE ROW LEVEL SECURITY;

-- سياسة: المديرون يديرون كل شيء
CREATE POLICY "المديرون يديرون تقدم المزامنة"
  ON public.background_sync_progress
  FOR ALL
  USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

-- سياسة: المستخدمون يرون تقدم مزامنتهم
CREATE POLICY "المستخدمون يرون تقدم مزامنتهم"
  ON public.background_sync_progress
  FOR SELECT
  USING (triggered_by = auth.uid() OR is_admin_or_deputy());

-- ===================================================================
-- المرحلة 2: تحسين جدول cities_regions_sync_log
-- ===================================================================

-- إضافة أعمدة جديدة لتتبع التقدم بشكل أفضل
ALTER TABLE public.cities_regions_sync_log 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;

-- تحديث timestamp trigger
CREATE OR REPLACE FUNCTION update_cities_regions_sync_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = COALESCE(NEW.created_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_cities_regions_sync_log_timestamp ON public.cities_regions_sync_log;
CREATE TRIGGER set_cities_regions_sync_log_timestamp
  BEFORE INSERT OR UPDATE ON public.cities_regions_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION update_cities_regions_sync_log_timestamp();

-- ===================================================================
-- المرحلة 3: تفعيل Realtime للجداول
-- ===================================================================

-- تفعيل Realtime لجدول background_sync_progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.background_sync_progress;

-- تفعيل Realtime لجدول cities_regions_sync_log  
ALTER PUBLICATION supabase_realtime ADD TABLE public.cities_regions_sync_log;

-- ===================================================================
-- Comments للتوثيق
-- ===================================================================

COMMENT ON TABLE public.background_sync_progress IS 'تتبع تقدم المزامنة الذكية للمدن والمناطق في الخلفية';
COMMENT ON COLUMN public.background_sync_progress.status IS 'حالة المزامنة: in_progress, completed, failed';
COMMENT ON COLUMN public.background_sync_progress.current_city_name IS 'اسم المدينة الحالية التي يتم معالجتها';