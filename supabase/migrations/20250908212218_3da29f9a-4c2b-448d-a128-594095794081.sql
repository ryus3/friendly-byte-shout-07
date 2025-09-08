-- Recompute balances with stable ordering and apply to main cash source
CREATE OR REPLACE FUNCTION public.recompute_cash_source_balances(p_source_id uuid, p_starting_balance numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $func$
DECLARE
  v_updated_count integer := 0;
  v_last_balance numeric := p_starting_balance;
BEGIN
  -- Recompute balances: created_at ASC, IN before OUT, id ASC
  WITH ordered AS (
    SELECT 
      cm.id,
      cm.amount,
      cm.movement_type,
      cm.created_at,
      CASE 
        WHEN lower(cm.movement_type) IN ('in','deposit','add','revenue','income','sale','receipt') THEN 0
        ELSE 1
      END AS movement_type_order,
      CASE 
        WHEN lower(cm.movement_type) IN ('in','deposit','add','revenue','income','sale','receipt') THEN cm.amount
        ELSE -cm.amount
      END AS delta
    FROM cash_movements cm
    WHERE cm.cash_source_id = p_source_id
  ),
  ranked AS (
    SELECT 
      o.*,
      ROW_NUMBER() OVER (ORDER BY o.created_at ASC, o.movement_type_order ASC, o.id ASC) AS rn
    FROM ordered o
  ),
  running AS (
    SELECT 
      r.id,
      (p_starting_balance + COALESCE(SUM(r.delta) OVER (ORDER BY r.rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)) AS new_before,
      (p_starting_balance + SUM(r.delta) OVER (ORDER BY r.rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS new_after
    FROM ranked r
  ),
  upd AS (
    UPDATE cash_movements cm
    SET 
      balance_before = round(r.new_before::numeric, 2),
      balance_after  = round(r.new_after::numeric, 2),
      updated_at = now()
    FROM running r
    WHERE cm.id = r.id
    RETURNING cm.balance_after
  )
  SELECT COALESCE((ARRAY(SELECT balance_after FROM upd ORDER BY balance_after DESC LIMIT 1))[1], p_starting_balance)
  INTO v_last_balance;

  -- Sync the cash source current balance
  UPDATE cash_sources cs
  SET current_balance = v_last_balance,
      updated_at = now()
  WHERE cs.id = p_source_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_rows', v_updated_count,
    'last_balance', v_last_balance
  );
END;
$func$;

-- Apply to main cash source with explicit starting balance 5,000,000
DO $$
DECLARE
  v_main uuid;
  v_result jsonb;
BEGIN
  SELECT id
  INTO v_main
  FROM cash_sources
  WHERE name IN ('القاصة الرئيسية','القاصه الرئيسية','Main Cash','Main Vault')
  ORDER BY is_active DESC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_main IS NOT NULL THEN
    v_result := public.recompute_cash_source_balances(v_main, 5000000);
    RAISE NOTICE 'Recompute result: %', v_result;
  ELSE
    RAISE NOTICE 'Main cash source not found. Skipping recompute.';
  END IF;
END $$;