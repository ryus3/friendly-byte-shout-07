-- Add effective_at column to cash_movements for proper chronological ordering
ALTER TABLE public.cash_movements 
ADD COLUMN effective_at TIMESTAMP WITH TIME ZONE;

-- Backfill effective_at from source events
UPDATE public.cash_movements cm
SET effective_at = COALESCE(
  -- For order revenue: use receipt_received_at
  (SELECT o.receipt_received_at 
   FROM orders o 
   WHERE o.id = cm.reference_id 
   AND cm.reference_type = 'order' 
   AND cm.movement_type = 'in'),
  
  -- For employee dues expenses: use approved_at
  (SELECT e.approved_at 
   FROM expenses e 
   WHERE e.id = cm.reference_id 
   AND cm.reference_type = 'expense' 
   AND cm.movement_type = 'out'),
   
  -- For profit settlements: use settled_at
  (SELECT p.settled_at 
   FROM profits p 
   WHERE p.id = cm.reference_id 
   AND cm.reference_type = 'profit' 
   AND cm.movement_type = 'out'),
   
  -- Default to created_at if no source timestamp found
  cm.created_at
);

-- Make effective_at NOT NULL with default
ALTER TABLE public.cash_movements 
ALTER COLUMN effective_at SET NOT NULL,
ALTER COLUMN effective_at SET DEFAULT now();

-- Create trigger to auto-set effective_at for new movements
CREATE OR REPLACE FUNCTION public.set_cash_movement_effective_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- Set effective_at based on reference source
  NEW.effective_at := COALESCE(
    -- For order revenue: use receipt_received_at
    (SELECT o.receipt_received_at 
     FROM orders o 
     WHERE o.id = NEW.reference_id 
     AND NEW.reference_type = 'order' 
     AND NEW.movement_type = 'in'),
    
    -- For employee dues expenses: use approved_at
    (SELECT e.approved_at 
     FROM expenses e 
     WHERE e.id = NEW.reference_id 
     AND NEW.reference_type = 'expense' 
     AND NEW.movement_type = 'out'),
     
    -- For profit settlements: use settled_at
    (SELECT p.settled_at 
     FROM profits p 
     WHERE p.id = NEW.reference_id 
     AND NEW.reference_type = 'profit' 
     AND NEW.movement_type = 'out'),
     
    -- Default to now() for manual movements
    now()
  );
  
  RETURN NEW;
END;
$function$;

-- Attach trigger
CREATE TRIGGER set_cash_movement_effective_at_trigger
  BEFORE INSERT ON public.cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cash_movement_effective_at();

-- Update balance calculation function to use effective_at
CREATE OR REPLACE FUNCTION public.recompute_cash_source_balances(p_source_id uuid, p_starting_balance numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_updated_count integer := 0;
  v_last_balance numeric := p_starting_balance;
BEGIN
  -- Recompute balances using effective_at for proper chronological order
  WITH ordered AS (
    SELECT 
      cm.id,
      cm.amount,
      cm.movement_type,
      cm.effective_at,
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
      ROW_NUMBER() OVER (ORDER BY o.effective_at ASC, o.movement_type_order ASC, o.id ASC) AS rn
    FROM ordered o
  ),
  running AS (
    SELECT 
      r.id,
      (p_starting_balance + COALESCE(SUM(r.delta) OVER (ORDER BY r.rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)) AS new_before,
      (p_starting_balance + SUM(r.delta) OVER (ORDER BY r.rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS new_after
    FROM ranked r
  )
  UPDATE cash_movements cm
  SET 
    balance_before = round(r.new_before::numeric, 2),
    balance_after  = round(r.new_after::numeric, 2)
  FROM running r
  WHERE cm.id = r.id;

  -- Count updated rows
  SELECT COUNT(*) INTO v_updated_count FROM cash_movements WHERE cash_source_id = p_source_id;

  -- Get last balance using effective_at ordering
  SELECT cm.balance_after
  INTO v_last_balance
  FROM cash_movements cm
  WHERE cm.cash_source_id = p_source_id
  ORDER BY 
    cm.effective_at DESC,
    (CASE WHEN lower(cm.movement_type) IN ('in','deposit','add','revenue','income','sale','receipt') THEN 0 ELSE 1 END) DESC,
    cm.id DESC
  LIMIT 1;

  -- Update cash source balance
  UPDATE cash_sources cs
  SET current_balance = v_last_balance
  WHERE cs.id = p_source_id;

  RETURN jsonb_build_object(
    'success', true,
    'updated_rows', v_updated_count,
    'last_balance', v_last_balance
  );
END;
$function$;

-- Recalculate all cash source balances with proper effective_at ordering
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
    RAISE NOTICE 'Recomputed main cash source balances using effective_at: %', v_result;
  ELSE
    RAISE NOTICE 'Main cash source not found.';
  END IF;
END $$;