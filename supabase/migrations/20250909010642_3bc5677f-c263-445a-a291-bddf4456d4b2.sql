-- إزالة تحديث updated_at من جدول المصروفات لعدم وجود العمود
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
  v_orders_array uuid[];
  v_order_id uuid;
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

  v_invoice_number := COALESCE(NULLIF(e.receipt_number,''), 'SET-'||to_char(now(),'YYYYMMDD-HH24MI'));
  v_invoice_number := v_invoice_number || '-' || right(e.id::text, 6);

  v_order_id := NULLIF((e.metadata->>'order_id')::uuid, NULL);
  IF v_order_id IS NOT NULL THEN
    v_orders_array := ARRAY[v_order_id];
  ELSE
    v_orders_array := ARRAY[]::uuid[];
  END IF;

  INSERT INTO public.settlement_invoices (
    invoice_number, employee_id, employee_name, employee_code,
    total_amount, settlement_date, description, payment_method,
    order_ids, settled_orders, notes, status, created_by
  )
  VALUES (
    v_invoice_number, v_employee_id, COALESCE(v_employee_name, 'غير محدد'), v_employee_code,
    v_total, COALESCE(e.approved_at, e.created_at, now()), e.description, 'expense',
    v_orders_array, to_jsonb(v_orders_array),
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
      order_ids = EXCLUDED.order_ids,
      settled_orders = EXCLUDED.settled_orders,
      status = EXCLUDED.status,
      updated_at = now()
  RETURNING id INTO v_invoice_id;

  UPDATE public.expenses
  SET metadata = COALESCE(e.metadata,'{}'::jsonb) || jsonb_build_object(
    'settlement_invoice_id', v_invoice_id, 
    'migrated_to_settlement', true,
    'invoice_number', v_invoice_number
  )
  WHERE id = e.id;

  RETURN jsonb_build_object(
    'success', true, 
    'invoice_id', v_invoice_id, 
    'invoice_number', v_invoice_number,
    'employee_name', v_employee_name,
    'total_amount', v_total,
    'tracking_number', e.metadata->>'tracking_number',
    'order_id', v_order_id
  );
END $$;