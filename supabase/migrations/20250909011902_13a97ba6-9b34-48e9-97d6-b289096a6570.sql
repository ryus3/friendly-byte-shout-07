-- 1) Generator for RY-style settlement invoice numbers (e.g., RY-EDC11E)
CREATE OR REPLACE FUNCTION public.generate_ry_settlement_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := 'RY-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.settlement_invoices WHERE invoice_number = candidate
    );
  END LOOP;
  RETURN candidate;
END $$;

-- 2) Unify number generation in pay_employee_dues_with_invoice to use RY pattern
CREATE OR REPLACE FUNCTION public.pay_employee_dues_with_invoice(
  p_employee_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT '',
  p_paid_by UUID DEFAULT NULL,
  p_order_ids UUID[] DEFAULT '{}',
  p_profit_ids UUID[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_id UUID;
  employee_name TEXT;
  invoice_number TEXT;
  settlement_invoice_id UUID;
BEGIN
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  SELECT full_name INTO employee_name FROM profiles WHERE user_id = p_employee_id;

  IF main_cash_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'القاصة الرئيسية غير موجودة');
  END IF;
  IF employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الموظف غير موجود');
  END IF;

  -- Use the unified RY generator
  invoice_number := public.generate_ry_settlement_invoice_number();

  INSERT INTO settlement_invoices (
    invoice_number, employee_id, employee_name, total_amount, settlement_date,
    description, order_ids, profit_ids, notes, created_by
  ) VALUES (
    invoice_number, p_employee_id, employee_name, p_amount, now(),
    COALESCE(p_description, 'دفع مستحقات الموظف ' || employee_name),
    p_order_ids, p_profit_ids,
    'فاتورة تسوية حقيقية - ' || COALESCE(p_description, ''),
    COALESCE(p_paid_by, auth.uid())
  ) RETURNING id INTO settlement_invoice_id;

  PERFORM public.update_cash_source_balance(
    main_cash_id, p_amount, 'out', 'employee_dues', settlement_invoice_id,
    'دفع مستحقات - فاتورة رقم: ' || invoice_number, COALESCE(p_paid_by, auth.uid())
  );

  INSERT INTO expenses (
    category, expense_type, description, amount, status, created_by,
    approved_by, approved_at, receipt_number, metadata
  ) VALUES (
    'مستحقات الموظفين', 'system',
    'دفع مستحقات الموظف ' || employee_name || ' - فاتورة: ' || invoice_number,
    p_amount, 'approved', COALESCE(p_paid_by, auth.uid()),
    COALESCE(p_paid_by, auth.uid()), now(), invoice_number,
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', employee_name,
      'settlement_invoice_id', settlement_invoice_id,
      'settlement_invoice_number', invoice_number,
      'payment_date', now(),
      'payment_type', 'employee_dues'
    )
  );

  UPDATE profits 
  SET status = 'settled', settled_at = now(), settled_by = COALESCE(p_paid_by, auth.uid())
  WHERE employee_id = p_employee_id AND status = 'pending'
    AND (array_length(p_profit_ids, 1) IS NULL OR id = ANY(p_profit_ids));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || employee_name || ' بنجاح',
    'invoice_number', invoice_number,
    'settlement_invoice_id', settlement_invoice_id,
    'amount', p_amount,
    'employee_name', employee_name,
    'settlement_date', now()
  );
END;
$$;

-- 3) Replace migration function: cash payment, proper order linking, detailed settled_orders, and RY numbers
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expense_by_id(p_expense_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  e RECORD;
  v_employee_id uuid;
  v_employee_name text;
  v_employee_code text;
  v_total numeric;
  v_invoice_number text;
  v_invoice_id uuid;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_order_id uuid;
  v_amt numeric;
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'expense_not_found');
  END IF;

  v_employee_id := NULLIF((e.metadata->>'employee_id')::uuid, NULL);
  IF v_employee_id IS NULL THEN
    v_employee_id := e.created_by;
  END IF;

  SELECT full_name, employee_code INTO v_employee_name, v_employee_code
  FROM public.profiles 
  WHERE user_id = v_employee_id;

  v_total := COALESCE((e.metadata->>'total_amount')::numeric, e.amount, 0);

  -- Respect existing RY-looking number if present, otherwise generate new RY
  IF (e.receipt_number ~* '^RY-[A-Z0-9]{6}$') THEN
    v_invoice_number := e.receipt_number;
  ELSE
    v_invoice_number := public.generate_ry_settlement_invoice_number();
  END IF;

  -- Parse order ids from metadata (supports order_id or order_ids arrays)
  v_order_id := NULLIF((e.metadata->>'order_id')::uuid, NULL);
  IF v_order_id IS NOT NULL THEN
    v_order_ids := ARRAY[v_order_id];
  ELSIF jsonb_typeof(e.metadata->'order_ids') = 'array' THEN
    v_order_ids := ARRAY(
      SELECT elem::uuid FROM jsonb_array_elements_text(e.metadata->'order_ids') AS t(elem)
      WHERE elem ~* '^[0-9a-f-]{36}$'
    );
  END IF;

  -- Deduplicate order ids
  IF v_order_ids IS NOT NULL AND array_length(v_order_ids,1) IS NOT NULL THEN
    v_order_ids := (SELECT ARRAY(SELECT DISTINCT x FROM unnest(v_order_ids) AS x));
  END IF;

  INSERT INTO public.settlement_invoices (
    invoice_number, employee_id, employee_name, employee_code,
    total_amount, settlement_date, description, payment_method,
    order_ids, settled_orders, notes, status, created_by
  )
  VALUES (
    v_invoice_number, v_employee_id, COALESCE(v_employee_name, 'غير محدد'), v_employee_code,
    v_total, COALESCE(e.approved_at, e.created_at, now()), e.description, 'cash',
    v_order_ids,
    -- Detailed settled_orders built from orders/profits
    (
      SELECT jsonb_agg(jsonb_build_object(
        'order_id', o.id,
        'order_number', COALESCE(o.order_number, o.tracking_number, o.id::text),
        'customer_name', o.customer_name,
        'final_amount', o.final_amount,
        'profit_id', p.id,
        'employee_profit', p.employee_profit,
        'profit_status', p.status
      ))
      FROM public.orders o
      LEFT JOIN public.profits p ON p.order_id = o.id
      WHERE v_order_ids IS NOT NULL AND array_length(v_order_ids,1) > 0 AND o.id = ANY(v_order_ids)
    ),
    'تم النقل من المصاريف - ' || COALESCE(e.metadata->>'tracking_number', ''),
    COALESCE(e.status,'pending'), COALESCE(e.approved_by, e.created_by)
  )
  ON CONFLICT (invoice_number) DO UPDATE
  SET employee_id = EXCLUDED.employee_id,
      employee_name = EXCLUDED.employee_name,
      employee_code = EXCLUDED.employee_code,
      total_amount = EXCLUDED.total_amount,
      settlement_date = EXCLUDED.settlement_date,
      description = EXCLUDED.description,
      payment_method = EXCLUDED.payment_method,
      order_ids = EXCLUDED.order_ids,
      settled_orders = EXCLUDED.settled_orders,
      status = EXCLUDED.status,
      updated_at = now()
  RETURNING id INTO v_invoice_id;

  -- Stamp back to expense
  UPDATE public.expenses
  SET metadata = COALESCE(e.metadata,'{}'::jsonb) || jsonb_build_object(
    'settlement_invoice_id', v_invoice_id, 
    'migrated_to_settlement', true,
    'settlement_invoice_number', v_invoice_number
  )
  WHERE id = e.id;

  RETURN jsonb_build_object(
    'success', true, 
    'invoice_id', v_invoice_id, 
    'invoice_number', v_invoice_number,
    'employee_name', v_employee_name,
    'total_amount', v_total,
    'order_ids', v_order_ids
  );
END $$;

-- 4) Data cleanup: enforce cash payment, dedupe orders, and normalize numbers
-- Force payment_method to cash
UPDATE public.settlement_invoices
SET payment_method = 'cash'
WHERE COALESCE(payment_method,'') <> 'cash';

-- Deduplicate order_ids arrays
UPDATE public.settlement_invoices si
SET order_ids = sub.dedup
FROM (
  SELECT id, CASE WHEN order_ids IS NULL THEN NULL
                  ELSE (SELECT ARRAY(SELECT DISTINCT x FROM unnest(order_ids) AS x)) END AS dedup
  FROM public.settlement_invoices
) sub
WHERE si.id = sub.id AND si.order_ids IS DISTINCT FROM sub.dedup;

-- Re-number invoices that do not match RY-XXXXXX pattern and mirror to expenses receipt_number
DO $$
DECLARE
  rec RECORD;
  new_num text;
BEGIN
  FOR rec IN SELECT id, invoice_number FROM public.settlement_invoices 
             WHERE invoice_number !~ '^RY-[A-Z0-9]{6}$'
  LOOP
    new_num := public.generate_ry_settlement_invoice_number();
    UPDATE public.settlement_invoices SET invoice_number = new_num, updated_at = now() WHERE id = rec.id;
    UPDATE public.expenses 
    SET receipt_number = new_num,
        metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('settlement_invoice_number', new_num)
    WHERE (metadata->>'settlement_invoice_id')::uuid = rec.id;
  END LOOP;
END $$;

-- 5) Backfill settled_orders from order_ids when missing or empty
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, order_ids FROM public.settlement_invoices 
    WHERE (settled_orders IS NULL OR jsonb_typeof(settled_orders) <> 'array' OR jsonb_array_length(settled_orders)=0)
      AND order_ids IS NOT NULL AND array_length(order_ids,1) > 0
  LOOP
    UPDATE public.settlement_invoices si
    SET settled_orders = (
      SELECT jsonb_agg(jsonb_build_object(
        'order_id', o.id,
        'order_number', COALESCE(o.order_number, o.tracking_number, o.id::text),
        'customer_name', o.customer_name,
        'final_amount', o.final_amount,
        'profit_id', p.id,
        'employee_profit', p.employee_profit,
        'profit_status', p.status
      ))
      FROM public.orders o
      LEFT JOIN public.profits p ON p.order_id = o.id
      WHERE o.id = ANY(r.order_ids)
    ),
    updated_at = now()
    WHERE si.id = r.id;
  END LOOP;
END $$;