-- Clean up duplicate delivery fee and fix cash movements for ORD000005, then recalc balances
DO $$
DECLARE
  v_order RECORD;
  v_main_source UUID;
  v_rev_source UUID;
  v_tracking TEXT;
  v_expense_id UUID;
  v_deleted_5k INT := 0;
  v_deleted_other INT := 0;
BEGIN
  -- 1) Locate the order
  SELECT id, order_number, tracking_number, final_amount, created_by, payment_received_source_id
  INTO v_order
  FROM public.orders
  WHERE order_number = 'ORD000005'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order ORD000005 not found';
  END IF;

  -- 2) Main cash source
  SELECT id INTO v_main_source
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية'
  ORDER BY created_at
  LIMIT 1;

  IF v_main_source IS NULL THEN
    RAISE EXCEPTION 'Main cash source not found';
  END IF;

  -- Prefer order-specific payment source if present
  v_rev_source := COALESCE(v_order.payment_received_source_id, v_main_source);

  -- Resolve a canonical tracking string for matching
  v_tracking := COALESCE(NULLIF(v_order.tracking_number, ''), NULLIF(v_order.order_number, ''), v_order.id::text);

  -- 3) Remove any -5000 delivery-fee movements tied to this order explicitly
  DELETE FROM public.cash_movements
  WHERE (cash_source_id = v_main_source OR cash_source_id = v_rev_source)
    AND movement_type = 'out'
    AND amount = 5000
    AND (
      reference_id = v_order.id
      OR description ILIKE '%' || v_tracking || '%'
      OR description ILIKE '%' || v_order.order_number || '%'
    );
  GET DIAGNOSTICS v_deleted_5k = ROW_COUNT;

  -- 4) Remove any prior movements for this order to avoid duplicates (we will recreate canonical ones)
  DELETE FROM public.cash_movements
  WHERE (cash_source_id = v_main_source OR cash_source_id = v_rev_source)
    AND (
      reference_id = v_order.id
      OR description ILIKE '%' || v_tracking || '%'
      OR description ILIKE '%' || v_order.order_number || '%'
    )
    AND (
      (movement_type = 'in' AND amount IN (21000)) OR
      (movement_type = 'out' AND amount IN (7000))
    );
  GET DIAGNOSTICS v_deleted_other = ROW_COUNT;

  -- 5) Remove any existing employee-dues expense linked to this order to avoid duplicates
  DELETE FROM public.expenses 
  WHERE category = 'مستحقات الموظفين'
    AND metadata ? 'order_id'
    AND (metadata->>'order_id')::uuid = v_order.id;

  -- 6) Correct the profits row for this order
  UPDATE public.profits
  SET total_revenue = 21000,
      employee_profit = 7000,
      updated_at = now()
  WHERE order_id = v_order.id;

  -- 7) Insert an approved expense for employee dues (7,000)
  INSERT INTO public.expenses (
    amount, created_by, approved_by, approved_at,
    expense_type, category, description, status, metadata
  ) VALUES (
    7000, v_order.created_by, v_order.created_by, now(),
    'system', 'مستحقات الموظفين',
    'مستحقات موظفين - طلب تتبع ' || v_tracking,
    'approved',
    jsonb_build_object('order_id', v_order.id, 'tracking_number', v_tracking)
  ) RETURNING id INTO v_expense_id;

  -- 8) Recreate canonical movements using RPC to maintain correct balances
  PERFORM public.update_cash_source_balance(
    v_rev_source,
    21000,
    'in',
    'order',
    v_order.id,
    'بيع طلب - رقم التتبع ' || v_tracking || '، صافي المستلم 21,000 د.ع',
    v_order.created_by
  );

  PERFORM public.update_cash_source_balance(
    v_main_source,
    7000,
    'out',
    'employee_dues',
    v_expense_id,
    'مستحقات موظفين - طلب تتبع ' || v_tracking || ' بقيمة 7,000 د.ع',
    v_order.created_by
  );

  -- 9) Recalculate running balances for the main cash source to ensure consistency
  WITH ordered AS (
    SELECT 
      id,
      created_at,
      CASE WHEN movement_type = 'in' THEN amount ELSE -amount END AS delta,
      ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM public.cash_movements
    WHERE cash_source_id = v_main_source
  ),
  base AS (
    SELECT balance_before AS base_balance
    FROM public.cash_movements
    WHERE cash_source_id = v_main_source
    ORDER BY created_at, id
    LIMIT 1
  ),
  calc AS (
    SELECT 
      o.id,
      (SELECT b.base_balance FROM base b) + COALESCE(SUM(o2.delta) FILTER (WHERE o2.rn < o.rn), 0) AS new_before,
      (SELECT b.base_balance FROM base b) + COALESCE(SUM(o2.delta) FILTER (WHERE o2.rn <= o.rn), 0) AS new_after
    FROM ordered o
    LEFT JOIN ordered o2 ON true
    GROUP BY o.id
  )
  UPDATE public.cash_movements cm
  SET balance_before = c.new_before,
      balance_after  = c.new_after,
      updated_at = now()
  FROM calc c
  WHERE cm.id = c.id
    AND cm.cash_source_id = v_main_source;

  -- Also recalc for the revenue source if it's different
  IF v_rev_source IS DISTINCT FROM v_main_source THEN
    WITH ordered AS (
      SELECT 
        id,
        created_at,
        CASE WHEN movement_type = 'in' THEN amount ELSE -amount END AS delta,
        ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
      FROM public.cash_movements
      WHERE cash_source_id = v_rev_source
    ),
    base AS (
      SELECT balance_before AS base_balance
      FROM public.cash_movements
      WHERE cash_source_id = v_rev_source
      ORDER BY created_at, id
      LIMIT 1
    ),
    calc AS (
      SELECT 
        o.id,
        (SELECT b.base_balance FROM base b) + COALESCE(SUM(o2.delta) FILTER (WHERE o2.rn < o.rn), 0) AS new_before,
        (SELECT b.base_balance FROM base b) + COALESCE(SUM(o2.delta) FILTER (WHERE o2.rn <= o.rn), 0) AS new_after
      FROM ordered o
      LEFT JOIN ordered o2 ON true
      GROUP BY o.id
    )
    UPDATE public.cash_movements cm
    SET balance_before = c.new_before,
        balance_after  = c.new_after,
        updated_at = now()
    FROM calc c
    WHERE cm.id = c.id
      AND cm.cash_source_id = v_rev_source;
  END IF;

  RAISE NOTICE 'تم حذف % حركة توصيل (5000) و % حركة قديمة أخرى، وأعيد احتساب الأرصدة.', v_deleted_5k, v_deleted_other;
END $$;