-- المرحلة 3: تنظيف البيانات القديمة وإنشاء functions جديدة

-- 1. تحديث المحاولات العالقة في background_sync_progress
UPDATE background_sync_progress
SET 
  status = 'failed',
  completed_at = now(),
  error_message = 'Timeout - العملية استغرقت وقتاً طويلاً واُلغيت تلقائياً'
WHERE status = 'in_progress'
  AND started_at < now() - interval '1 hour';

-- 2. إنشاء function للحصول على آخر مزامنة ناجحة فقط
CREATE OR REPLACE FUNCTION get_last_successful_cities_regions_sync()
RETURNS TABLE(
  last_sync_at timestamp with time zone,
  cities_count integer,
  regions_count integer,
  success boolean,
  sync_duration_seconds numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.last_sync_at,
    l.cities_count,
    l.regions_count,
    l.success,
    l.sync_duration_seconds
  FROM public.cities_regions_sync_log l
  WHERE l.success = true
  ORDER BY l.last_sync_at DESC
  LIMIT 1;
END;
$$;

-- 3. منح الصلاحيات للـ function الجديد
GRANT EXECUTE ON FUNCTION get_last_successful_cities_regions_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_successful_cities_regions_sync() TO anon;