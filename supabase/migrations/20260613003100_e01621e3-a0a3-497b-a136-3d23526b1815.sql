-- 1) Reset the 10 broken settled records
UPDATE profits
SET status = 'invoice_received', settled_at = NULL, updated_at = NOW()
WHERE employee_id = 'd46021fe-8cde-4575-97ac-c2661ee91527'
  AND status = 'settled'
  AND settled_at >= '2026-06-10'
  AND NOT EXISTS (SELECT 1 FROM settlement_invoice_orders sio WHERE sio.order_id = profits.order_id)
  AND NOT EXISTS (SELECT 1 FROM settlement_invoices si WHERE profits.order_id = ANY(si.order_ids));

UPDATE orders
SET isarchived = false, updated_at = NOW()
WHERE id IN (
  '918ed5ce-bf95-4f09-a614-3c7d8a3f5181','dd06f176-a172-4170-a138-0cdef285f7ed',
  'cc5c7751-ca92-439a-83dc-3049066a2668','8808d933-e3cd-45ed-8c8c-3d362817aeac',
  '9ca80c68-fce9-40e3-8db5-a554e7d59121','113a290a-2b7d-401b-9dc6-3c23e563b5e5',
  '572b9e25-f44f-4b73-b33e-901b72bda05a','5c096fe9-0ed9-4f32-a650-96f37b05f20c',
  '8b902a01-42ad-475e-986d-d8088356fe99','7ebaef11-f4ca-4c47-b2de-ada58301fe81'
);

-- 2) Rewrite RPC: compute amount internally, fully atomic
CREATE OR REPLACE FUNCTION public.pay_employee_dues_with_invoice(
  p_employee_id uuid,
  p_amount numeric DEFAULT NULL,
  p_order_ids uuid[] DEFAULT NULL::uuid[],
  p_profit_ids uuid[] DEFAULT NULL::uuid[],
  p_description text DEFAULT NULL::text,
  p_paid_by uuid DEFAULT NULL::uuid,
  p_owner_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_source_id UUID;
  v_cash_source_name TEXT;
  v_resolved_owner UUID := p_owner_user_id;
  v_employee_name TEXT;
  v_invoice_number TEXT;
  v_settlement_invoice_id UUID;
  v_creator UUID;
  v_cash_result JSONB;
  v_total_amount NUMERIC := 0;
  v_resolved_profit_ids uuid[];
  v_resolved_order_ids uuid[];
BEGIN
  v_creator := COALESCE(p_paid_by, auth.uid());
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تحديد المستخدم (auth.uid = null)';
  END IF;

  SELECT full_name INTO v_employee_name FROM profiles WHERE user_id = p_employee_id;
  IF v_employee_name IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود: %', p_employee_id;
  END IF;

  SELECT
    COALESCE(SUM(p.employee_profit), 0),
    array_agg(p.id),
    array_agg(p.order_id)
  INTO v_total_amount, v_resolved_profit_ids, v_resolved_order_ids
  FROM profits p
  WHERE p.employee_id = p_employee_id
    AND p.status IN ('pending', 'invoice_received', 'settlement_requested')
    AND (
      (p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 AND p.order_id = ANY(p_order_ids))
      OR (p_profit_ids IS NOT NULL AND array_length(p_profit_ids, 1) > 0 AND p.id = ANY(p_profit_ids))
    );

  IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
    RAISE EXCEPTION 'لا توجد أرباح قابلة للدفع للموظف % (المجموع: %)', v_employee_name, COALESCE(v_total_amount, 0);
  END IF;

  IF v_resolved_owner IS NULL THEN
    SELECT p.owner_user_id INTO v_resolved_owner
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = ANY(v_resolved_order_ids) AND p.owner_user_id IS NOT NULL
    GROUP BY p.owner_user_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  END IF;

  IF v_resolved_owner IS NOT NULL THEN
    SELECT id, name INTO v_cash_source_id, v_cash_source_name
    FROM cash_sources WHERE owner_user_id = v_resolved_owner AND is_active = true
    ORDER BY created_at LIMIT 1;
  END IF;

  IF v_cash_source_id IS NULL THEN
    SELECT id, name INTO v_cash_source_id, v_cash_source_name
    FROM cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1;
  END IF;

  IF v_cash_source_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد مصدر نقد مناسب لدفع المستحقات';
  END IF;

  v_invoice_number := public.generate_ry_settlement_invoice_number();

  INSERT INTO settlement_invoices (
    invoice_number, employee_id, employee_name, total_amount, settlement_date,
    description, order_ids, profit_ids, notes, created_by, owner_user_id
  ) VALUES (
    v_invoice_number, p_employee_id, v_employee_name, v_total_amount, now(),
    COALESCE(p_description, 'دفع مستحقات الموظف ' || v_employee_name),
    v_resolved_order_ids, v_resolved_profit_ids,
    'فاتورة تسوية - ' || COALESCE(p_description, ''),
    v_creator, v_resolved_owner
  ) RETURNING id INTO v_settlement_invoice_id;

  v_cash_result := public.update_cash_source_balance(
    v_cash_source_id, v_total_amount, 'out', 'settlement_invoice', v_settlement_invoice_id,
    'دفع مستحقات الموظف ' || v_employee_name || ' - فاتورة ' || v_invoice_number,
    v_creator
  );

  IF NOT COALESCE((v_cash_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'فشل تحديث رصيد القاصة: %', v_cash_result->>'error';
  END IF;

  INSERT INTO expenses (
    category, expense_type, description, amount, status, created_by,
    approved_by, approved_at, receipt_number, metadata
  ) VALUES (
    'مستحقات الموظفين', 'system',
    'دفع مستحقات الموظف ' || v_employee_name || ' - فاتورة: ' || v_invoice_number,
    v_total_amount, 'approved', v_creator, v_creator, now(), v_invoice_number,
    jsonb_build_object(
      'employee_id', p_employee_id, 'employee_name', v_employee_name,
      'settlement_invoice_id', v_settlement_invoice_id,
      'settlement_invoice_number', v_invoice_number,
      'payment_date', now(), 'payment_type', 'employee_dues',
      'owner_user_id', v_resolved_owner,
      'cash_source_id', v_cash_source_id,
      'cash_source_name', v_cash_source_name,
      'cash_movement_id', v_cash_result->>'movement_id'
    )
  );

  UPDATE profits
  SET status = 'settled', settled_at = now(), updated_at = now()
  WHERE id = ANY(v_resolved_profit_ids);

  INSERT INTO settlement_invoice_orders (settlement_invoice_id, order_id, created_at)
  SELECT v_settlement_invoice_id, unnest(v_resolved_order_ids), now()
  ON CONFLICT DO NOTHING;

  UPDATE orders SET isarchived = true, updated_at = now()
  WHERE id = ANY(v_resolved_order_ids);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || v_employee_name || ' بنجاح',
    'invoice_number', v_invoice_number,
    'settlement_invoice_id', v_settlement_invoice_id,
    'amount', v_total_amount,
    'employee_name', v_employee_name,
    'settlement_date', now(),
    'owner_user_id', v_resolved_owner,
    'cash_source_id', v_cash_source_id,
    'cash_source_name', v_cash_source_name,
    'cash_movement_id', v_cash_result->>'movement_id',
    'orders_count', array_length(v_resolved_order_ids, 1)
  );
END;
$function$;

-- 3) Full back-fill: recalc employee_profit for ALL orders (including 'settled')
WITH rule_match AS (
  SELECT
    o.id AS order_id,
    oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price,
    o.created_by, o.created_at, o.discount, o.price_increase,
    epr.profit_amount AS rule_profit, epr.profit_percentage AS rule_pct,
    COALESCE(pv.cost_price, pr.cost_price, 0) AS unit_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products pr ON pr.id = oi.product_id
  LEFT JOIN product_variants pv ON pv.id = oi.variant_id
  LEFT JOIN LATERAL (
    SELECT profit_amount, profit_percentage
    FROM employee_profit_rules
    WHERE employee_id = o.created_by AND is_active = true
      AND (
        (rule_type = 'variant' AND target_id = oi.variant_id::text)
        OR (rule_type = 'product' AND target_id = oi.product_id::text)
      )
      AND created_at <= o.created_at
    ORDER BY CASE rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END
    LIMIT 1
  ) epr ON true
  WHERE o.created_by IS NOT NULL
),
per_order AS (
  SELECT
    rm.order_id,
    SUM(CASE WHEN rm.rule_profit IS NOT NULL THEN COALESCE(rm.total_price, rm.unit_price * rm.quantity, 0) ELSE 0 END) AS items_with_rule,
    SUM(CASE WHEN rm.rule_profit IS NULL THEN COALESCE(rm.total_price, rm.unit_price * rm.quantity, 0) ELSE 0 END) AS items_without_rule,
    SUM(
      CASE
        WHEN rm.rule_profit IS NULL THEN 0
        WHEN COALESCE(rm.rule_pct, 0) = 100 THEN GREATEST(0, (COALESCE(rm.unit_price, 0) - COALESCE(rm.unit_cost, 0)) * rm.quantity)
        ELSE COALESCE(rm.rule_profit, 0) * rm.quantity
      END
    ) AS base_rule_profit,
    MAX(rm.discount) AS discount,
    MAX(rm.price_increase) AS price_increase
  FROM rule_match rm
  GROUP BY rm.order_id
),
computed AS (
  SELECT
    po.order_id,
    GREATEST(0,
      po.base_rule_profit
      + CASE WHEN (po.items_with_rule + po.items_without_rule) > 0 AND po.items_with_rule > 0
             THEN COALESCE(po.price_increase, 0) * (po.items_with_rule / (po.items_with_rule + po.items_without_rule))
             ELSE 0 END
      - CASE WHEN (po.items_with_rule + po.items_without_rule) > 0 AND po.items_with_rule > 0
             THEN COALESCE(po.discount, 0) * (po.items_with_rule / (po.items_with_rule + po.items_without_rule))
             ELSE 0 END
    ) AS new_profit
  FROM per_order po
  WHERE po.base_rule_profit > 0
)
UPDATE profits p
SET employee_profit = c.new_profit, updated_at = NOW()
FROM computed c
WHERE p.order_id = c.order_id
  AND p.employee_profit IS DISTINCT FROM c.new_profit;