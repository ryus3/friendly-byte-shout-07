-- Fix ORD000005 cash movements and profits using dynamic discovery and correct movement types
DO $$
DECLARE
  v_order RECORD;
  v_main_source UUID;
  v_revenue NUMERIC := 21000; -- net revenue to record (e.g., 26,000 - 5,000)
  v_emp_dues NUMERIC := 7000; -- employee dues to pay out
  v_tracking TEXT;
  v_expense_id UUID;
  v_rev_source UUID;
BEGIN
  -- Locate the target order by order number
  SELECT id, order_number, tracking_number, final_amount, created_by, payment_received_source_id
  INTO v_order
  FROM public.orders
  WHERE order_number = 'ORD000005'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order ORD000005 not found';
  END IF;

  -- Get the main cash source id
  SELECT id INTO v_main_source
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية'
  ORDER BY created_at
  LIMIT 1;

  IF v_main_source IS NULL THEN
    RAISE EXCEPTION 'Main cash source not found';
  END IF;

  -- Prefer order-specific payment source if present, otherwise main cash source
  v_rev_source := COALESCE(v_order.payment_received_source_id, v_main_source);

  -- Resolve tracking for descriptions (fallback to order number, then id)
  v_tracking := COALESCE(NULLIF(v_order.tracking_number, ''), NULLIF(v_order.order_number, ''), v_order.id::text);

  -- 1) Cleanup any prior incorrect cash movements for this order
  DELETE FROM public.cash_movements
  WHERE reference_id = v_order.id
     OR description ILIKE '%' || v_order.order_number || '%'
     OR description ILIKE '%' || v_tracking || '%';

  -- 2) Remove any existing employee-dues expense linked to this order to avoid duplicates
  DELETE FROM public.expenses 
  WHERE category = 'مستحقات الموظفين'
    AND metadata ? 'order_id'
    AND (metadata->>'order_id')::uuid = v_order.id;

  -- 3) Update profits to reflect the correct net revenue and employee share
  UPDATE public.profits
  SET total_revenue = v_revenue,
      employee_profit = v_emp_dues,
      updated_at = now()
  WHERE order_id = v_order.id;

  -- 4) Create expense record for employee dues (approved)
  INSERT INTO public.expenses (
    amount, created_by, approved_by, approved_at,
    expense_type, category, description, status, metadata
  ) VALUES (
    v_emp_dues, v_order.created_by, v_order.created_by, now(),
    'system', 'مستحقات الموظفين',
    'مستحقات موظفين - طلب تتبع ' || v_tracking,
    'approved',
    jsonb_build_object('order_id', v_order.id, 'tracking_number', v_tracking)
  ) RETURNING id INTO v_expense_id;

  -- 5) Insert correct revenue movement (+21,000) using the RPC (ensures balances are correct)
  PERFORM public.update_cash_source_balance(
    v_rev_source,
    v_revenue,
    'in',
    'order',
    v_order.id,
    'بيع طلب - رقم التتبع ' || v_tracking || '، صافي المستلم ' || to_char(v_revenue, 'FM999,999,999') || ' د.ع',
    v_order.created_by
  );

  -- 6) Insert employee dues movement (-7,000) using the RPC and link to the expense
  PERFORM public.update_cash_source_balance(
    v_main_source,
    v_emp_dues,
    'out',
    'employee_dues',
    v_expense_id,
    'مستحقات موظفين - طلب تتبع ' || v_tracking || ' بقيمة ' || to_char(v_emp_dues, 'FM999,999,999') || ' د.ع',
    v_order.created_by
  );
END $$;