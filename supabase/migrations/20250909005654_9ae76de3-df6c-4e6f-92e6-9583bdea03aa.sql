BEGIN;

-- 1) Create settlement_invoices table
CREATE TABLE IF NOT EXISTS public.settlement_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  employee_id uuid NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  issued_at timestamptz DEFAULT now(),
  notes text,
  source_expense_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Create settlement_invoice_orders table
CREATE TABLE IF NOT EXISTS public.settlement_invoice_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_invoice_id uuid NOT NULL REFERENCES public.settlement_invoices(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  profit_id uuid NULL REFERENCES public.profits(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_invoice_id, order_id)
);

-- 3) Triggers to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_settlement_invoices_updated_at'
  ) THEN
    CREATE TRIGGER trg_settlement_invoices_updated_at
    BEFORE UPDATE ON public.settlement_invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_settlement_invoice_orders_updated_at'
  ) THEN
    CREATE TRIGGER trg_settlement_invoice_orders_updated_at
    BEFORE UPDATE ON public.settlement_invoice_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
END$$;

-- 4) Enable RLS
ALTER TABLE public.settlement_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_invoice_orders ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies
DO $$
BEGIN
  -- Admin policies for settlement_invoices
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settlement_invoices' AND policyname='Admins manage settlement invoices') THEN
    CREATE POLICY "Admins manage settlement invoices"
    ON public.settlement_invoices
    FOR ALL
    USING (is_admin_or_deputy() OR check_user_permission(auth.uid(),'manage_profits'))
    WITH CHECK (is_admin_or_deputy() OR check_user_permission(auth.uid(),'manage_profits'));
  END IF;

  -- Employee view own
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settlement_invoices' AND policyname='Employees view own settlement invoices') THEN
    CREATE POLICY "Employees view own settlement invoices"
    ON public.settlement_invoices
    FOR SELECT
    USING (employee_id = auth.uid() OR created_by = auth.uid());
  END IF;

  -- Employee insert own request
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settlement_invoices' AND policyname='Employees insert own settlement invoices') THEN
    CREATE POLICY "Employees insert own settlement invoices"
    ON public.settlement_invoices
    FOR INSERT
    WITH CHECK (employee_id = auth.uid() OR created_by = auth.uid());
  END IF;

  -- Admin policies for settlement_invoice_orders
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settlement_invoice_orders' AND policyname='Admins manage settlement_invoice_orders') THEN
    CREATE POLICY "Admins manage settlement_invoice_orders"
    ON public.settlement_invoice_orders
    FOR ALL
    USING (is_admin_or_deputy() OR check_user_permission(auth.uid(),'manage_profits'))
    WITH CHECK (is_admin_or_deputy() OR check_user_permission(auth.uid(),'manage_profits'));
  END IF;

  -- Employee view own linked via parent invoice
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='settlement_invoice_orders' AND policyname='Employees view own settlement_invoice_orders') THEN
    CREATE POLICY "Employees view own settlement_invoice_orders"
    ON public.settlement_invoice_orders
    FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.settlement_invoices si
      WHERE si.id = settlement_invoice_id
      AND (si.employee_id = auth.uid() OR si.created_by = auth.uid())
    ));
  END IF;
END $$;

-- 6) Helper to generate unique settlement invoice numbers
CREATE OR REPLACE FUNCTION public.generate_settlement_invoice_number(p_hint text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  base text := COALESCE(NULLIF(TRIM(p_hint),''), 'SET-'||to_char(now(),'YYYYMMDD'));
  candidate text;
  i int := 0;
BEGIN
  LOOP
    candidate := base || CASE WHEN i = 0 THEN '' ELSE '-'||lpad(i::text,2,'0') END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.settlement_invoices WHERE invoice_number = candidate);
    i := i + 1;
    IF i > 99 THEN
      candidate := base || '-' || right(gen_random_uuid()::text,4);
      EXIT;
    END IF;
  END LOOP;
  RETURN candidate;
END $$;

-- 7) Migrate one expense by id
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expense_by_id(p_expense_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  e RECORD;
  v_employee_id uuid;
  v_total numeric;
  v_invoice_number text;
  v_invoice_id uuid;
  v_orders jsonb;
  v_order_id uuid;
  v_amount numeric;
  v_count int := 0;
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'expense_not_found');
  END IF;

  v_employee_id := NULLIF((e.metadata->>'employee_id')::uuid, NULL);
  IF v_employee_id IS NULL THEN
    v_employee_id := e.created_by;
  END IF;

  v_total := COALESCE((e.metadata->>'total_amount')::numeric, e.amount, 0);

  v_invoice_number := COALESCE(NULLIF(e.receipt_number,''), NULLIF(e.description,''), NULL);
  v_invoice_number := public.generate_settlement_invoice_number(v_invoice_number);

  INSERT INTO public.settlement_invoices (invoice_number, employee_id, total_amount, orders_count, status, issued_at, notes, source_expense_id, metadata, created_by)
  VALUES (v_invoice_number, v_employee_id, v_total, 0, COALESCE(e.status,'pending'), COALESCE(e.approved_at, e.created_at, now()), e.description, e.id, COALESCE(e.metadata,'{}'::jsonb), COALESCE(e.approved_by, e.created_by))
  ON CONFLICT (invoice_number) DO UPDATE
  SET employee_id = EXCLUDED.employee_id,
      total_amount = EXCLUDED.total_amount,
      status = EXCLUDED.status,
      issued_at = EXCLUDED.issued_at,
      notes = EXCLUDED.notes,
      source_expense_id = EXCLUDED.source_expense_id,
      metadata = COALESCE(public.settlement_invoices.metadata,'{}'::jsonb) || EXCLUDED.metadata,
      updated_at = now()
  RETURNING id INTO v_invoice_id;

  v_orders := COALESCE(e.metadata->'order_ids', e.metadata->'settled_orders', e.metadata->'orders', '[]'::jsonb);

  FOR v_order_id, v_amount IN
    SELECT 
      (elem->>'order_id')::uuid as order_id,
      COALESCE((elem->>'amount')::numeric, 0) as amount
    FROM jsonb_array_elements(
      CASE 
        WHEN jsonb_typeof(v_orders) = 'array' THEN v_orders
        ELSE '[]'::jsonb
      END
    ) as elem
  LOOP
    IF v_order_id IS NOT NULL THEN
      INSERT INTO public.settlement_invoice_orders (settlement_invoice_id, order_id, amount)
      VALUES (v_invoice_id, v_order_id, v_amount)
      ON CONFLICT (settlement_invoice_id, order_id) DO UPDATE
      SET amount = EXCLUDED.amount,
          updated_at = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count = 0 AND jsonb_typeof(v_orders) = 'array' THEN
    FOR v_order_id IN
      SELECT (elem)::text::uuid
      FROM jsonb_array_elements_text(v_orders) elem
      WHERE elem ~* '^[0-9a-f-]{36}$'
    LOOP
      INSERT INTO public.settlement_invoice_orders (settlement_invoice_id, order_id, amount)
      VALUES (v_invoice_id, v_order_id, 0)
      ON CONFLICT (settlement_invoice_id, order_id) DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  END IF;

  UPDATE public.settlement_invoices
  SET orders_count = v_count,
      updated_at = now()
  WHERE id = v_invoice_id;

  UPDATE public.expenses
  SET metadata = COALESCE(e.metadata,'{}'::jsonb) || jsonb_build_object('settlement_invoice_id', v_invoice_id, 'migrated_to_settlement', true),
      updated_at = now()
  WHERE id = e.id;

  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number, 'orders_linked', v_count);
END $$;

-- 8) Batch migrate helper
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expenses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  rec RECORD;
  processed int := 0;
  migrated int := 0;
  res jsonb;
BEGIN
  FOR rec IN
    SELECT e.id
    FROM public.expenses e
    WHERE (e.metadata->>'migrated_to_settlement') IS DISTINCT FROM 'true'
      AND (e.expense_type = 'employee_dues' OR e.category = 'employee_dues' OR e.description ILIKE '%مستحق%' OR e.description ILIKE '%تسوية%')
  LOOP
    processed := processed + 1;
    res := public.migrate_employee_dues_expense_by_id(rec.id);
    IF (res->>'success')::boolean THEN
      migrated := migrated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', processed, 'migrated', migrated);
END $$;

COMMIT;