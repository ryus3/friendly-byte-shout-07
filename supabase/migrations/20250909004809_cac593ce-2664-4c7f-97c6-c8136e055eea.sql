-- Fix migration: ensure one settlement invoice per expense (employee dues)
-- 1) Add unique index on invoice_number to prevent merging
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'ux_settlement_invoices_invoice_number'
  ) THEN
    CREATE UNIQUE INDEX ux_settlement_invoices_invoice_number
      ON public.settlement_invoices (invoice_number);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If there are duplicates, skip creating the index for now
  RAISE NOTICE 'Could not create unique index on settlement_invoices.invoice_number: %', SQLERRM;
END$$;

-- 2) Single-expense migration function
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expense_by_id(p_expense_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  e RECORD;
  v_employee_id uuid;
  v_employee_name text;
  v_employee_code text;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_invoice_number text;
  v_settlement_date timestamptz;
  v_created_by uuid;
  v_invoice_id uuid;
  v_action text := 'skipped';
  v_settled_orders jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'expense_not_found');
  END IF;

  -- Only migrate employee dues expenses
  IF COALESCE(e.category, '') <> 'مستحقات الموظفين' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_employee_dues');
  END IF;

  -- Extract core fields
  v_employee_id := COALESCE((e.metadata->>'employee_id')::uuid, e.created_by);
  v_employee_name := COALESCE(e.metadata->>'employee_name', 'غير محدد');
  v_created_by := COALESCE(e.approved_by, e.created_by);
  v_settlement_date := COALESCE(e.approved_at, e.created_at);
  v_invoice_number := NULLIF(e.receipt_number, '');
  IF v_invoice_number IS NULL THEN
    v_invoice_number := 'RY-' || upper(right(e.id::text, 6));
  END IF;

  -- Build order_ids array from metadata.order_ids
  IF jsonb_typeof(e.metadata->'order_ids') = 'array' THEN
    SELECT COALESCE(array_agg((val)::uuid), ARRAY[]::uuid[])
    INTO v_order_ids
    FROM (
      SELECT json_array_elements_text(e.metadata->'order_ids')::uuid AS val
    ) s;
  END IF;

  -- Fetch employee_code if available
  SELECT employee_code INTO v_employee_code
  FROM public.profiles
  WHERE user_id = v_employee_id
  LIMIT 1;

  -- Optionally build a lightweight settled_orders JSON from orders
  IF array_length(v_order_ids, 1) IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'final_amount', o.final_amount,
        'created_at', o.created_at
      )), '[]'::jsonb)
    INTO v_settled_orders
    FROM public.orders o
    WHERE o.id = ANY(v_order_ids);
  END IF;

  -- Upsert by invoice_number to guarantee one row per expense/invoice
  INSERT INTO public.settlement_invoices (
    invoice_number,
    employee_id,
    employee_name,
    employee_code,
    total_amount,
    settlement_date,
    created_by,
    status,
    order_ids,
    settled_orders,
    payment_method,
    description,
    notes
  ) VALUES (
    v_invoice_number,
    v_employee_id,
    v_employee_name,
    v_employee_code,
    e.amount,
    v_settlement_date,
    v_created_by::text,
    'completed',
    v_order_ids,
    v_settled_orders,
    COALESCE(e.metadata->>'payment_method', 'cash'),
    e.description,
    ('Migrated from expense ' || e.id::text)
  )
  ON CONFLICT (invoice_number) DO UPDATE SET
    employee_id = EXCLUDED.employee_id,
    employee_name = EXCLUDED.employee_name,
    employee_code = EXCLUDED.employee_code,
    total_amount = EXCLUDED.total_amount,
    settlement_date = EXCLUDED.settlement_date,
    created_by = EXCLUDED.created_by,
    status = EXCLUDED.status,
    order_ids = EXCLUDED.order_ids,
    settled_orders = EXCLUDED.settled_orders,
    payment_method = EXCLUDED.payment_method,
    description = EXCLUDED.description,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_invoice_id;

  v_action := CASE WHEN NOT FOUND THEN 'inserted' ELSE 'upserted' END;

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'order_ids_count', COALESCE(array_length(v_order_ids,1), 0)
  );
END;
$$;

-- 3) Bulk migration function
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expenses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rec RECORD;
  v_processed int := 0;
  v_inserted int := 0;
  v_updated int := 0;
  v_errors int := 0;
  v_result jsonb;
BEGIN
  FOR rec IN 
    SELECT id
    FROM public.expenses e
    WHERE COALESCE(e.category,'') = 'مستحقات الموظفين'
      AND (e.metadata->>'settlement_type') = 'employee_dues'
      AND COALESCE(e.status,'approved') IN ('approved','paid','completed')
  LOOP
    BEGIN
      v_result := public.migrate_employee_dues_expense_by_id(rec.id);
      v_processed := v_processed + 1;
      IF (v_result->>'success')::boolean THEN
        IF (v_result->>'action') IN ('inserted','upserted') THEN
          IF (v_result->>'action') = 'inserted' THEN
            v_inserted := v_inserted + 1;
          ELSE
            v_updated := v_updated + 1;
          END IF;
        END IF;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'inserted', v_inserted,
    'updated', v_updated,
    'errors', v_errors
  );
END;
$$;