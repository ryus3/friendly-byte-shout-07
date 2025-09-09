-- Create or replace a function to migrate employee dues expenses into settlement_invoices
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expenses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  rec RECORD;
  migrated_count INT := 0;
  skipped_count INT := 0;
  emp_name TEXT;
  emp_code TEXT;
  employee_uuid UUID;
  inv_number TEXT;
  settlement_ts TIMESTAMPTZ;
  status_text TEXT;
  payment_method TEXT;
  order_ids_text TEXT[];
  profit_ids_uuid UUID[];
  settled_orders JSONB;
  creator UUID;
  existing_id UUID;
BEGIN
  FOR rec IN
    SELECT e.*
    FROM expenses e
    WHERE (
      e.expense_type IN ('employee_dues','employee_settlement','settlement_invoice')
      OR e.category ILIKE '%مستحقات%' OR e.category ILIKE '%settlement%'
      OR e.description ILIKE '%مستحقات%' OR e.description ILIKE '%تسوية%'
      OR (e.metadata ? 'type' AND (e.metadata->>'type') IN ('employee_dues','employee_settlement','settlement_invoice'))
    )
    AND e.created_at > now() - interval '365 days'
  LOOP
    employee_uuid := COALESCE(
      NULLIF((rec.metadata->>'employee_id'),'')::uuid,
      NULLIF((rec.metadata->>'employee_uuid'),'')::uuid,
      rec.created_by
    );

    SELECT p.full_name, p.employee_code
      INTO emp_name, emp_code
    FROM profiles p
    WHERE p.user_id = employee_uuid
    LIMIT 1;

    IF employee_uuid IS NULL OR emp_name IS NULL THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    inv_number := COALESCE(
      NULLIF(rec.receipt_number,''),
      NULLIF(rec.metadata->>'invoice_number',''),
      'SINV-'||to_char(rec.created_at,'YYYYMMDD')||'-'||substr(rec.id::text,1,6)
    );

    settlement_ts := COALESCE(rec.approved_at, rec.created_at);

    status_text := CASE 
      WHEN rec.status IN ('approved','paid','completed') THEN 'completed'
      WHEN rec.status = 'pending' THEN 'pending'
      ELSE COALESCE(NULLIF(rec.status,''),'completed')
    END;

    payment_method := COALESCE(NULLIF(rec.payment_method,''),'cash');

    order_ids_text := NULL;
    IF (rec.metadata ? 'order_ids') THEN
      order_ids_text := ARRAY(SELECT jsonb_array_elements_text(rec.metadata->'order_ids'));
    ELSIF (rec.metadata ? 'orders') THEN
      order_ids_text := ARRAY(SELECT jsonb_array_elements_text(rec.metadata->'orders'));
    END IF;

    profit_ids_uuid := NULL;
    IF (rec.metadata ? 'profit_ids') THEN
      profit_ids_uuid := ARRAY(
        SELECT (jsonb_array_elements_text(rec.metadata->'profit_ids'))::uuid
      );
    END IF;

    settled_orders := NULL;
    IF (rec.metadata ? 'settled_orders') THEN
      settled_orders := rec.metadata->'settled_orders';
    END IF;

    creator := COALESCE(rec.approved_by, rec.created_by);

    SELECT id INTO existing_id 
    FROM settlement_invoices 
    WHERE invoice_number = inv_number
      AND employee_id = employee_uuid
    LIMIT 1;

    IF existing_id IS NULL THEN
      INSERT INTO settlement_invoices (
        created_by, description, employee_code, employee_id, employee_name,
        invoice_number, notes, order_ids, payment_method, profit_ids,
        settled_orders, settlement_date, status, total_amount
      ) VALUES (
        creator, rec.description, emp_code, employee_uuid, emp_name,
        inv_number, rec.vendor_name, order_ids_text, payment_method, profit_ids_uuid,
        COALESCE(settled_orders, rec.metadata), settlement_ts, status_text, rec.amount
      );
      migrated_count := migrated_count + 1;
    ELSE
      UPDATE settlement_invoices
      SET 
        description = COALESCE(settlement_invoices.description, rec.description),
        employee_code = COALESCE(settlement_invoices.employee_code, emp_code),
        employee_name = COALESCE(settlement_invoices.employee_name, emp_name),
        notes = COALESCE(settlement_invoices.notes, rec.vendor_name),
        order_ids = COALESCE(settlement_invoices.order_ids, order_ids_text),
        payment_method = COALESCE(settlement_invoices.payment_method, payment_method),
        profit_ids = COALESCE(settlement_invoices.profit_ids, profit_ids_uuid),
        settled_orders = COALESCE(settlement_invoices.settled_orders, COALESCE(settled_orders, rec.metadata)),
        settlement_date = COALESCE(settlement_invoices.settlement_date, settlement_ts),
        status = COALESCE(settlement_invoices.status, status_text),
        total_amount = COALESCE(settlement_invoices.total_amount, rec.amount),
        updated_at = now()
      WHERE id = existing_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'skipped_count', skipped_count
  );
END;
$$;