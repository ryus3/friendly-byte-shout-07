-- دالة محسنة لجلب معلومات آخر مزامنة مع أداء أفضل
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

-- دالة محسنة لتسجيل بداية مزامنة المدن والمناطق
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

-- دالة محسنة لتسجيل نهاية مزامنة المدن والمناطق
CREATE OR REPLACE FUNCTION public.log_cities_regions_sync_end(
  p_sync_id uuid,
  p_start_time timestamptz,
  p_cities_count integer,
  p_regions_count integer,
  p_success boolean,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duration_seconds numeric;
BEGIN
  duration_seconds := EXTRACT(EPOCH FROM (now() - p_start_time));
  
  UPDATE public.cities_regions_sync_log
  SET 
    cities_count = p_cities_count,
    regions_count = p_regions_count,
    success = p_success,
    sync_duration_seconds = duration_seconds,
    error_message = p_error_message,
    last_sync_at = now()
  WHERE id = p_sync_id;
END;
$$;