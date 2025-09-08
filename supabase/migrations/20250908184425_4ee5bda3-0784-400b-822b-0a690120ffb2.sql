-- Adjust main cash source detection to rely on name only
DROP FUNCTION IF EXISTS public.calculate_real_main_cash_balance();

CREATE OR REPLACE FUNCTION public.calculate_real_main_cash_balance()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_main_id uuid;
  v_sum numeric := 0;
BEGIN
  SELECT id
  INTO v_main_id
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_main_id IS NULL THEN
    -- fallback to the first source if main not named correctly
    SELECT id INTO v_main_id FROM public.cash_sources ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_main_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_sum
  FROM public.cash_movements
  WHERE cash_source_id = v_main_id;

  RETURN v_sum;
END;
$$;

-- Recreate trigger function only if not exists (safe)
CREATE OR REPLACE FUNCTION public.enforce_order_receipt_for_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt boolean := false;
  v_is_order_ref boolean := false;
  v_is_revenue boolean := false;
BEGIN
  v_is_order_ref := lower(COALESCE(NEW.reference_type, '')) IN ('order', 'order_revenue', 'order_income');
  v_is_revenue := lower(COALESCE(NEW.movement_type, '')) IN ('order_revenue', 'order_income', 'revenue');

  IF v_is_order_ref AND v_is_revenue AND NEW.reference_id IS NOT NULL THEN
    SELECT COALESCE(receipt_received, false)
    INTO v_receipt
    FROM public.orders
    WHERE id = NEW.reference_id;

    IF COALESCE(v_receipt, false) = false THEN
      RAISE EXCEPTION 'لا يمكن تسجيل إيراد للطلب قبل استلام الفاتورة (receipt_received=false)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 't_enforce_order_receipt_for_revenue'
  ) THEN
    DROP TRIGGER t_enforce_order_receipt_for_revenue ON public.cash_movements;
  END IF;

  CREATE TRIGGER t_enforce_order_receipt_for_revenue
  BEFORE INSERT OR UPDATE OF movement_type, reference_type, reference_id
  ON public.cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_receipt_for_revenue();
END $$;

-- Data corrections with name-based main source
DO $$
DECLARE
  v_main_id uuid;
  v_admin uuid := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  r5 uuid; r8 uuid; r10 uuid;
BEGIN
  SELECT id INTO v_main_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' ORDER BY created_at ASC LIMIT 1;
  IF v_main_id IS NULL THEN
    SELECT id INTO v_main_id FROM public.cash_sources ORDER BY created_at ASC LIMIT 1;
  END IF;

  SELECT id INTO r5 FROM public.orders WHERE order_number = 'ORD000005' LIMIT 1;
  SELECT id INTO r8 FROM public.orders WHERE order_number = 'ORD000008' LIMIT 1;
  SELECT id INTO r10 FROM public.orders WHERE order_number = 'ORD000010' LIMIT 1;

  IF r5 IS NOT NULL THEN
    DELETE FROM public.cash_movements WHERE reference_id = r5 AND lower(movement_type) = 'delivery_fee';
  END IF;
  IF r8 IS NOT NULL THEN
    DELETE FROM public.cash_movements WHERE reference_id = r8 AND lower(movement_type) = 'delivery_fee';
  END IF;

  IF r5 IS NOT NULL AND v_main_id IS NOT NULL THEN
    DELETE FROM public.cash_movements 
    WHERE reference_id = r5 
      AND lower(reference_type) IN ('order', 'order_revenue', 'order_income')
      AND lower(movement_type) IN ('order_revenue', 'order_income', 'revenue');

    INSERT INTO public.cash_movements (id, cash_source_id, amount, reference_id, reference_type, movement_type, description, created_by)
    VALUES (gen_random_uuid(), v_main_id, 21000, r5, 'order', 'order_revenue', 'إيراد طلب ORD000005 (صافي بدون توصيل)', v_admin);

    DELETE FROM public.cash_movements 
    WHERE reference_id = r5 
      AND lower(reference_type) IN ('profit', 'profit_settlement', 'employee_dues')
      AND lower(movement_type) IN ('employee_dues', 'employee_due', 'employee_dues_paid');

    INSERT INTO public.cash_movements (id, cash_source_id, amount, reference_id, reference_type, movement_type, description, created_by)
    VALUES (gen_random_uuid(), v_main_id, -7000, r5, 'employee_dues', 'employee_dues', 'دفع مستحقات موظف لطلب ORD000005', v_admin);

    BEGIN UPDATE public.orders SET final_amount = 26000 WHERE id = r5; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.orders SET delivery_fee = 5000 WHERE id = r5; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN PERFORM public.calculate_order_profit(r5); EXCEPTION WHEN undefined_function THEN NULL; END;
  END IF;

  IF r8 IS NOT NULL AND v_main_id IS NOT NULL THEN
    DELETE FROM public.cash_movements 
    WHERE reference_id = r8 
      AND lower(reference_type) IN ('order', 'order_revenue', 'order_income')
      AND lower(movement_type) IN ('order_revenue', 'order_income', 'revenue');

    INSERT INTO public.cash_movements (id, cash_source_id, amount, reference_id, reference_type, movement_type, description, created_by)
    VALUES (gen_random_uuid(), v_main_id, 21000, r8, 'order', 'order_revenue', 'إيراد طلب ORD000008 (صافي بدون توصيل)', v_admin);

    BEGIN UPDATE public.orders SET final_amount = 26000 WHERE id = r8; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.orders SET delivery_fee = 5000 WHERE id = r8; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN PERFORM public.calculate_order_profit(r8); EXCEPTION WHEN undefined_function THEN NULL; END;
  END IF;

  IF r10 IS NOT NULL THEN
    DELETE FROM public.cash_movements 
    WHERE reference_id = r10 
      AND lower(reference_type) IN ('order', 'order_revenue', 'order_income')
      AND lower(movement_type) IN ('order_revenue', 'order_income', 'revenue');

    BEGIN UPDATE public.orders SET receipt_received = false, receipt_received_at = NULL, receipt_received_by = NULL WHERE id = r10; EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
END $$;

-- Recalculate balances for all cash sources from movements and sync both possible columns
DO $$
BEGIN
  BEGIN
    UPDATE public.cash_sources cs
    SET current_balance = COALESCE(m.sum_amount, 0)
    FROM (
      SELECT cash_source_id, SUM(amount) AS sum_amount
      FROM public.cash_movements
      GROUP BY cash_source_id
    ) m
    WHERE cs.id = m.cash_source_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  BEGIN
    UPDATE public.cash_sources cs
    SET balance = COALESCE(m.sum_amount, 0)
    FROM (
      SELECT cash_source_id, SUM(amount) AS sum_amount
      FROM public.cash_movements
      GROUP BY cash_source_id
    ) m
    WHERE cs.id = m.cash_source_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;
END $$;

-- Force main card value equal to calculated balance
DO $$
DECLARE
  v_main_id uuid;
  v_real numeric := 0;
BEGIN
  v_real := public.calculate_real_main_cash_balance();
  SELECT id INTO v_main_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' ORDER BY created_at ASC LIMIT 1;
  IF v_main_id IS NULL THEN SELECT id INTO v_main_id FROM public.cash_sources ORDER BY created_at ASC LIMIT 1; END IF;
  IF v_main_id IS NOT NULL THEN
    BEGIN UPDATE public.cash_sources SET current_balance = v_real WHERE id = v_main_id; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.cash_sources SET balance = v_real WHERE id = v_main_id; EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
END $$;