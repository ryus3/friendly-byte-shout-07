-- Cleanup cash movements after anchor movement and remove duplicate delivery fee (5,000 IQD)
DO $$
DECLARE
  v_anchor_id uuid;
  v_anchor_time timestamptz;
  v_source_id uuid;
  v_deleted_after int := 0;
  v_dup_fee_deleted int := 0;
BEGIN
  -- Locate the anchor movement by tracking/reference in description
  SELECT id, created_at, cash_source_id
  INTO v_anchor_id, v_anchor_time, v_source_id
  FROM public.cash_movements
  WHERE (
    description ILIKE '%RYUS-299923%'
    OR COALESCE(reference_id::text, '') ILIKE '%RYUS-299923%'
  )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_anchor_time IS NULL THEN
    RAISE NOTICE 'Anchor movement not found for RYUS-299923, no changes applied.';
    RETURN;
  END IF;

  -- Delete all movements after the anchor within the same cash source only
  DELETE FROM public.cash_movements
  WHERE cash_source_id = v_source_id
    AND created_at > v_anchor_time;
  GET DIAGNOSTICS v_deleted_after = ROW_COUNT;

  -- Remove a duplicated delivery fee (5,000) for same reference around the anchor, keep earliest one
  WITH candidate_fees AS (
    SELECT id
    FROM public.cash_movements
    WHERE cash_source_id = v_source_id
      AND movement_type = 'out'
      AND ABS((amount)::numeric) IN (5000, 5000.0)
      AND (
        description ILIKE '%توصيل%'
        OR COALESCE(reference_type,'') ILIKE '%delivery%'
      )
      AND (
        description ILIKE '%RYUS-299923%'
        OR COALESCE(reference_id::text,'') ILIKE '%RYUS-299923%'
      )
      AND created_at BETWEEN (v_anchor_time - interval '7 days') AND (v_anchor_time + interval '7 days')
    ORDER BY created_at ASC
  ), dupes AS (
    -- keep first, delete the rest if multiple exist
    SELECT id
    FROM candidate_fees
    OFFSET 1
  )
  DELETE FROM public.cash_movements cm
  USING dupes d
  WHERE cm.id = d.id;
  GET DIAGNOSTICS v_dup_fee_deleted = ROW_COUNT;

  RAISE NOTICE 'Cleanup done: % movements deleted after anchor, % duplicate delivery fee rows removed.',
    v_deleted_after, v_dup_fee_deleted;
END;
$$;