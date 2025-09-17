-- إزالة الدالة القديمة وإنشاء المحسنة
DROP FUNCTION IF EXISTS public.get_last_cities_regions_sync();

-- دالة محسنة لجلب معلومات آخر مزامنة
CREATE OR REPLACE FUNCTION public.get_last_cities_regions_sync()
RETURNS TABLE(
  last_sync_at timestamptz,
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
  ORDER BY l.last_sync_at DESC
  LIMIT 1;
END;
$$;

-- دالة محسنة لتسجيل بداية المزامنة
CREATE OR REPLACE FUNCTION public.log_cities_regions_sync_start()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sync_id uuid;
BEGIN
  INSERT INTO public.cities_regions_sync_log (
    id,
    last_sync_at,
    cities_count,
    regions_count,
    success,
    created_at
  ) VALUES (
    gen_random_uuid(),
    now(),
    0,
    0,
    false,
    now()
  ) RETURNING id INTO sync_id;
  
  RETURN sync_id;
END;
$$;