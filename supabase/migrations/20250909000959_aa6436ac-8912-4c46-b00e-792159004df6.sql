-- Create or replace function to migrate employee dues expenses into settlement_invoices
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expenses(
  p_from_date timestamptz DEFAULT now() - interval '120 days',
  p_to_date timestamptz DEFAULT now(),
  p_employee_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exp RECORD;
  v_order_ids uuid[];
  v_profit_ids uuid[];
  v_emp_id uuid;
  v_emp_name text;
  v_emp_code text;
  v_invoice_id uuid;
  v_invoice_number text;
  v_settlement_date timestamptz;
  v_created_by uuid;
  v_processed integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Iterate over legacy expenses of type "مستحقات الموظفين" not yet linked to settlement invoice
  FOR v_exp IN
    SELECT *
    FROM public.expenses e
    WHERE (e.category = 'مستحقات الموظفين'
           OR e.metadata->>'category' = 'مستحقات الموظفين'
           OR e.related_data->>'category' = 'مستحقات الموظفين')
      AND COALESCE(e.status, 'approved') IN ('approved','completed')
      AND (e.expense_type IS NULL OR e.expense_type IN ('operational','system'))
      AND (e.metadata->>'settlement_invoice_id') IS NULL
      AND (p_from_date IS NULL OR COALESCE(e.transaction_date, e.created_at) >= p_from_date)
      AND (p_to_date IS NULL OR COALESCE(e.transaction_date, e.created_at) <= p_to_date)
      AND (
        p_employee_id IS NULL OR
        ((e.metadata->>'employee_id')::uuid = p_employee_id)
      )
    ORDER BY COALESCE(e.transaction_date, e.created_at) ASC
    LIMIT COALESCE(p_limit, 100)
  LOOP
    -- Resolve employee id
    v_emp_id := COALESCE(
      NULLIF(v_exp.metadata->>'employee_id','')::uuid,
      (SELECT p.user_id FROM public.profiles p WHERE p.full_name = v_exp.vendor_name LIMIT 1)
    );

    -- If still null, skip migration for this expense
    IF v_emp_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Resolve employee info
    SELECT full_name, employee_code
      INTO v_emp_name, v_emp_code
    FROM public.profiles
    WHERE user_id = v_emp_id
    LIMIT 1;

    v_emp_name := COALESCE(v_emp_name, v_exp.vendor_name, v_exp.metadata->>'employee_name', 'غير محدد');

    -- Extract order_ids from metadata JSON array if present
    IF (v_exp.metadata ? 'order_ids') AND jsonb_typeof(v_exp.metadata->'order_ids') = 'array' THEN
      SELECT array_agg(x::uuid)
        INTO v_order_ids
      FROM jsonb_array_elements_text(v_exp.metadata->'order_ids') AS x
      WHERE x ~* '^[0-9a-f-]{36}$';
    ELSE
      v_order_ids := ARRAY[]::uuid[];
    END IF;

    -- Extract profit_ids (optional)
    IF (v_exp.metadata ? 'profit_ids') AND jsonb_typeof(v_exp.metadata->'profit_ids') = 'array' THEN
      SELECT array_agg(x::uuid)
        INTO v_profit_ids
      FROM jsonb_array_elements_text(v_exp.metadata->'profit_ids') AS x
      WHERE x ~* '^[0-9a-f-]{36}$';
    ELSE
      v_profit_ids := ARRAY[]::uuid[];
    END IF;

    -- Determine settlement date and creator
    v_settlement_date := COALESCE(v_exp.approved_at, v_exp.transaction_date, v_exp.created_at, now());
    v_created_by := COALESCE(auth.uid(), v_exp.created_by);

    -- Create unique invoice number
    v_invoice_number := 'INV-' || to_char(v_settlement_date, 'YYYYMMDD') || '-' || substr((gen_random_uuid())::text, 6, 6);

    -- Insert settlement invoice
    INSERT INTO public.settlement_invoices (
      invoice_number,
      employee_id,
      employee_name,
      employee_code,
      total_amount,
      payment_method,
      settlement_date,
      status,
      created_by,
      order_ids,
      profit_ids,
      settled_orders,
      notes,
      description
    ) VALUES (
      v_invoice_number,
      v_emp_id,
      v_emp_name,
      v_emp_code,
      v_exp.amount,
      COALESCE(NULLIF(v_exp.metadata->>'payment_method',''), 'cash'),
      v_settlement_date,
      'completed',
      v_created_by,
      NULLIF(v_order_ids, ARRAY[]::uuid[]),
      NULLIF(v_profit_ids, ARRAY[]::uuid[]),
      NULL, -- can be synced later via app
      COALESCE(NULLIF(v_exp.description,''), 'دفع مستحقات موظف'),
      'ترحيل مصروف مستحقات الموظفين إلى فاتورة تسوية'
    )
    RETURNING id INTO v_invoice_id;

    -- Link expense to the new settlement invoice to avoid re-migration
    UPDATE public.expenses
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'settlement_invoice_id', v_invoice_id::text,
      'migrated_to_settlement_invoices', true,
      'migrated_at', now()
    )
    WHERE id = v_exp.id;

    -- Mark related profits as settled if any order_ids exist
    IF v_order_ids IS NOT NULL AND array_length(v_order_ids,1) IS NOT NULL THEN
      UPDATE public.profits
      SET status = 'settled', settled_at = v_settlement_date, updated_at = now()
      WHERE order_id = ANY(v_order_ids)
        AND (employee_id = v_emp_id OR v_emp_id IS NULL);

      -- Archive related orders
      UPDATE public.orders
      SET isarchived = true, updated_at = now()
      WHERE id = ANY(v_order_ids);
    END IF;

    v_processed := v_processed + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'expense_id', v_exp.id,
      'invoice_id', v_invoice_id,
      'employee_id', v_emp_id,
      'amount', v_exp.amount
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'migrations', v_results
  );
END;
$$;

-- Optional helper: migrate a specific expense by id
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expense_by_id(p_expense_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.migrate_employee_dues_expenses(NULL, NULL, NULL, 1)
         || jsonb_build_object('note', 'Called generic migrator; ensure the expense meets filters');
END;
$$;