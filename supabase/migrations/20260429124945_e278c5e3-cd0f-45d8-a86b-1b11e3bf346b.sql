-- 1) get_city_external_id: respect partner via city_delivery_mappings only
CREATE OR REPLACE FUNCTION public.get_city_external_id(
  p_city_id integer,
  p_delivery_partner text DEFAULT 'alwaseet'
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_external_id text;
BEGIN
  -- Primary: lookup mapping by canonical city_id + partner
  SELECT external_id INTO v_external_id
  FROM public.city_delivery_mappings
  WHERE city_id = p_city_id
    AND delivery_partner = p_delivery_partner
    AND COALESCE(is_active, true) = true
  LIMIT 1;

  IF v_external_id IS NOT NULL THEN
    RETURN v_external_id;
  END IF;

  -- Fallback: maybe caller already passed an external_id
  SELECT external_id INTO v_external_id
  FROM public.city_delivery_mappings
  WHERE external_id = p_city_id::text
    AND delivery_partner = p_delivery_partner
    AND COALESCE(is_active, true) = true
  LIMIT 1;

  RETURN v_external_id; -- NULL if not found, no defaulting
END;
$function$;

-- 2) get_region_external_id: respect partner via region_delivery_mappings only
CREATE OR REPLACE FUNCTION public.get_region_external_id(
  p_region_id integer,
  p_delivery_partner text DEFAULT 'alwaseet'
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_external_id text;
BEGIN
  -- Primary: mapping by canonical region_id + partner
  SELECT external_id INTO v_external_id
  FROM public.region_delivery_mappings
  WHERE region_id = p_region_id
    AND delivery_partner = p_delivery_partner
    AND COALESCE(is_active, true) = true
  LIMIT 1;

  IF v_external_id IS NOT NULL THEN
    RETURN v_external_id;
  END IF;

  -- Fallback: maybe caller already passed external_id
  SELECT external_id INTO v_external_id
  FROM public.region_delivery_mappings
  WHERE external_id = p_region_id::text
    AND delivery_partner = p_delivery_partner
    AND COALESCE(is_active, true) = true
  LIMIT 1;

  RETURN v_external_id;
END;
$function$;

-- 3) resolve_partner_location: unified resolver used by Smart Order approval
CREATE OR REPLACE FUNCTION public.resolve_partner_location(
  p_partner text,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_region_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_city_canonical_id integer;
  v_city_external_id text;
  v_city_name_resolved text;
  v_region_canonical_id integer;
  v_region_external_id text;
  v_region_name_resolved text;
BEGIN
  IF p_partner IS NULL OR p_partner = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'partner_required',
      'message', 'لم يتم تحديد شركة التوصيل');
  END IF;

  -------------------------------------------------------------------
  -- CITY RESOLUTION
  -------------------------------------------------------------------
  -- Try canonical city_id first
  IF p_city_id IS NOT NULL THEN
    SELECT cm.city_id, cm.external_id, cmaster.name
      INTO v_city_canonical_id, v_city_external_id, v_city_name_resolved
    FROM public.city_delivery_mappings cm
    JOIN public.cities_master cmaster ON cmaster.id = cm.city_id
    WHERE cm.delivery_partner = p_partner
      AND cm.city_id = p_city_id
      AND COALESCE(cm.is_active, true) = true
    LIMIT 1;

    -- Maybe p_city_id was actually an external_id
    IF v_city_external_id IS NULL THEN
      SELECT cm.city_id, cm.external_id, cmaster.name
        INTO v_city_canonical_id, v_city_external_id, v_city_name_resolved
      FROM public.city_delivery_mappings cm
      JOIN public.cities_master cmaster ON cmaster.id = cm.city_id
      WHERE cm.delivery_partner = p_partner
        AND cm.external_id = p_city_id::text
        AND COALESCE(cm.is_active, true) = true
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback: by name
  IF v_city_external_id IS NULL AND p_city_name IS NOT NULL AND TRIM(p_city_name) <> '' THEN
    SELECT cm.city_id, cm.external_id, cmaster.name
      INTO v_city_canonical_id, v_city_external_id, v_city_name_resolved
    FROM public.cities_master cmaster
    JOIN public.city_delivery_mappings cm
      ON cm.city_id = cmaster.id
     AND cm.delivery_partner = p_partner
     AND COALESCE(cm.is_active, true) = true
    WHERE LOWER(TRIM(cmaster.name)) = LOWER(TRIM(p_city_name))
       OR LOWER(TRIM(cmaster.name)) LIKE '%' || LOWER(TRIM(p_city_name)) || '%'
       OR LOWER(TRIM(p_city_name)) LIKE '%' || LOWER(TRIM(cmaster.name)) || '%'
    ORDER BY
      CASE WHEN LOWER(TRIM(cmaster.name)) = LOWER(TRIM(p_city_name)) THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_city_external_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'city_not_mapped',
      'partner', p_partner,
      'requested_city_id', p_city_id,
      'requested_city_name', p_city_name,
      'message', 'تعذر تحديد المحافظة لشريك "' || p_partner ||
                 '". المحافظة "' || COALESCE(p_city_name, p_city_id::text, '?') ||
                 '" غير مرتبطة بهذا الشريك.'
    );
  END IF;

  -------------------------------------------------------------------
  -- REGION RESOLUTION (must belong to canonical city)
  -------------------------------------------------------------------
  -- Try canonical region_id with partner + same canonical city
  IF p_region_id IS NOT NULL THEN
    SELECT rm.region_id, rm.external_id, rmaster.name
      INTO v_region_canonical_id, v_region_external_id, v_region_name_resolved
    FROM public.region_delivery_mappings rm
    JOIN public.regions_master rmaster ON rmaster.id = rm.region_id
    WHERE rm.delivery_partner = p_partner
      AND rm.region_id = p_region_id
      AND rmaster.city_id = v_city_canonical_id
      AND COALESCE(rm.is_active, true) = true
    LIMIT 1;

    -- Maybe p_region_id is already external_id
    IF v_region_external_id IS NULL THEN
      SELECT rm.region_id, rm.external_id, rmaster.name
        INTO v_region_canonical_id, v_region_external_id, v_region_name_resolved
      FROM public.region_delivery_mappings rm
      JOIN public.regions_master rmaster ON rmaster.id = rm.region_id
      WHERE rm.delivery_partner = p_partner
        AND rm.external_id = p_region_id::text
        AND rmaster.city_id = v_city_canonical_id
        AND COALESCE(rm.is_active, true) = true
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback: by name within the same canonical city
  IF v_region_external_id IS NULL AND p_region_name IS NOT NULL AND TRIM(p_region_name) <> '' THEN
    SELECT rm.region_id, rm.external_id, rmaster.name
      INTO v_region_canonical_id, v_region_external_id, v_region_name_resolved
    FROM public.regions_master rmaster
    JOIN public.region_delivery_mappings rm
      ON rm.region_id = rmaster.id
     AND rm.delivery_partner = p_partner
     AND COALESCE(rm.is_active, true) = true
    WHERE rmaster.city_id = v_city_canonical_id
      AND (
        LOWER(TRIM(rmaster.name)) = LOWER(TRIM(p_region_name))
        OR LOWER(TRIM(rmaster.name)) LIKE '%' || LOWER(TRIM(p_region_name)) || '%'
        OR LOWER(TRIM(p_region_name)) LIKE '%' || LOWER(TRIM(rmaster.name)) || '%'
      )
    ORDER BY
      CASE WHEN LOWER(TRIM(rmaster.name)) = LOWER(TRIM(p_region_name)) THEN 0 ELSE 1 END,
      LENGTH(rmaster.name) ASC
    LIMIT 1;
  END IF;

  IF v_region_external_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'region_not_mapped',
      'partner', p_partner,
      'resolved_city_id', v_city_canonical_id,
      'resolved_city_external_id', v_city_external_id,
      'resolved_city_name', v_city_name_resolved,
      'requested_region_id', p_region_id,
      'requested_region_name', p_region_name,
      'message', 'تعذر تحديد المنطقة لشريك "' || p_partner ||
                 '" داخل محافظة "' || COALESCE(v_city_name_resolved, '?') ||
                 '". المنطقة "' || COALESCE(p_region_name, p_region_id::text, '?') ||
                 '" غير مربوطة بهذا الشريك. تأكد من اكتمال مزامنة كاش المدن والمناطق لهذه الشركة.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partner', p_partner,
    'city_id', v_city_canonical_id,
    'city_external_id', v_city_external_id,
    'city_name', v_city_name_resolved,
    'region_id', v_region_canonical_id,
    'region_external_id', v_region_external_id,
    'region_name', v_region_name_resolved
  );
END;
$function$;