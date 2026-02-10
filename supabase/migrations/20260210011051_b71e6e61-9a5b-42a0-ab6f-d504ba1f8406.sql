-- Create RPC function to get last successful sync by partner
CREATE OR REPLACE FUNCTION get_last_successful_cities_regions_sync_by_partner(partner_name text)
RETURNS TABLE (
  id uuid,
  last_sync_at timestamptz,
  cities_count integer,
  regions_count integer,
  success boolean,
  sync_duration_seconds numeric,
  delivery_partner text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    last_sync_at,
    cities_count,
    regions_count,
    success,
    sync_duration_seconds,
    delivery_partner
  FROM cities_regions_sync_log
  WHERE success = true 
    AND delivery_partner = partner_name
  ORDER BY last_sync_at DESC
  LIMIT 1;
$$;