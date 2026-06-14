-- 1) السماح بربح الموظف السالب وإزالة الحالة الخاطئة no_rule_archived للسالب
CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id uuid;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_employee_profit numeric := 0;
  v_profit_amount numeric := 0;
  v_item record;
  v_item_profit numeric;
  v_item_percentage numeric;
  v_item_cost numeric;
  v_item_price numeric;
  v_items_with_rules_total numeric := 0;
  v_items_without_rules_total numeric := 0;
  v_discount_for_rules numeric := 0;
  v_discount_for_no_rules numeric := 0;
  v_increase_for_rules numeric := 0;
  v_increase_for_no_rules numeric := 0;
  v_order_discount numeric := 0;
  v_order_increase numeric := 0;
  v_has_rule boolean;
  v_final_status text;
BEGIN
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    v_employee_id := NEW.created_by;
    IF v_employee_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_total_revenue := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    v_order_discount := COALESCE(NEW.discount, 0);
    v_order_increase := COALESCE(NEW.price_increase, 0);

    FOR v_item IN
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      v_item_price := COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity, 0);
      SELECT EXISTS(
        SELECT 1 FROM employee_profit_rules
        WHERE employee_id = v_employee_id AND is_active = true
          AND ((rule_type = 'product' AND target_id = v_item.product_id::text)
            OR (rule_type = 'variant' AND target_id = v_item.variant_id::text))
          AND created_at <= NEW.created_at
      ) INTO v_has_rule;
      IF v_has_rule THEN
        v_items_with_rules_total := v_items_with_rules_total + v_item_price;
      ELSE
        v_items_without_rules_total := v_items_without_rules_total + v_item_price;
      END IF;
    END LOOP;

    IF (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
      v_discount_for_rules    := v_order_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_discount_for_no_rules := v_order_discount * (v_items_without_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_increase_for_rules    := v_order_increase * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_increase_for_no_rules := v_order_increase * (v_items_without_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    ELSIF v_items_with_rules_total > 0 THEN
      v_discount_for_rules := v_order_discount;
      v_increase_for_rules := v_order_increase;
    ELSE
      -- لا توجد قاعدة لأي بند: نضع الكل ضمن "بقاعدة" حتى يطبق الخصم/الزيادة مباشرة على الموظف
      v_discount_for_rules := v_order_discount;
      v_increase_for_rules := v_order_increase;
    END IF;

    FOR v_item IN
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      SELECT COALESCE(pv.cost_price, p.cost_price, 0) INTO v_item_cost
      FROM products p LEFT JOIN product_variants pv ON pv.id = v_item.variant_id
      WHERE p.id = v_item.product_id;
      v_total_cost := v_total_cost + (COALESCE(v_item_cost, 0) * v_item.quantity);

      SELECT profit_amount, profit_percentage INTO v_item_profit, v_item_percentage
      FROM employee_profit_rules
      WHERE employee_id = v_employee_id AND is_active = true
        AND ((rule_type = 'product' AND target_id = v_item.product_id::text)
          OR (rule_type = 'variant' AND target_id = v_item.variant_id::text))
        AND created_at <= NEW.created_at
      ORDER BY CASE rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END LIMIT 1;

      IF COALESCE(v_item_percentage, 0) = 100 THEN
        v_employee_profit := v_employee_profit + GREATEST(0, (COALESCE(v_item.unit_price, 0) - COALESCE(v_item_cost, 0)) * v_item.quantity);
      ELSE
        v_employee_profit := v_employee_profit + (COALESCE(v_item_profit, 0) * v_item.quantity);
      END IF;
    END LOOP;

    v_profit_amount := v_total_revenue - v_total_cost;

    -- ✅ السماح بالربح السالب الحقيقي: قاعدة + زيادة - خصم بدون GREATEST(0)
    v_employee_profit := v_employee_profit + v_increase_for_rules - v_discount_for_rules;

    -- تسجيل خصم معلّق فقط للبنود بدون قاعدة (إن وجدت)
    IF v_discount_for_no_rules > 0 AND v_items_without_rules_total > 0 THEN
      INSERT INTO employee_pending_deductions (employee_id, order_id, amount, reason, status, created_at)
      VALUES (v_employee_id, NEW.id, v_discount_for_no_rules,
        'خصم نسبي على منتجات بدون قاعدة ربح - طلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
        'pending', NOW());
    END IF;

    -- الحالة: لا نعتبر السالب أو الصفر "no_rule_archived" تلقائياً إلا إذا فعلاً لا توجد قواعد ولا زيادة/خصم
    IF v_employee_profit = 0 AND v_items_with_rules_total = 0 AND v_order_discount = 0 AND v_order_increase = 0 THEN
      v_final_status := 'no_rule_archived';
    ELSIF NEW.receipt_received THEN
      v_final_status := 'invoice_received';
    ELSE
      v_final_status := 'pending';
    END IF;

    INSERT INTO profits (
      employee_id, order_id, total_revenue, total_cost, profit_amount,
      employee_percentage, employee_profit, status, settled_at, created_at, updated_at
    ) VALUES (
      v_employee_id, NEW.id, v_total_revenue, v_total_cost, v_profit_amount,
      0, v_employee_profit, v_final_status,
      CASE WHEN v_final_status = 'no_rule_archived' THEN NOW() ELSE NULL END, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = CASE
        WHEN profits.status = 'settled' THEN profits.status
        WHEN EXCLUDED.employee_profit = 0 AND EXCLUDED.status = 'no_rule_archived' THEN 'no_rule_archived'
        WHEN NEW.receipt_received THEN 'invoice_received'
        ELSE profits.status
      END,
      settled_at = CASE
        WHEN profits.status = 'settled' THEN profits.settled_at
        WHEN EXCLUDED.status = 'no_rule_archived' THEN NOW()
        ELSE profits.settled_at
      END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) RPC دفع المستحقات بشكل كامل وذرّي مع employee_code وsnapshot وأمبالغ ربط الطلبات وإشعار للموظف
CREATE OR REPLACE FUNCTION public.pay_employee_dues_with_invoice(
  p_employee_id uuid,
  p_amount numeric DEFAULT NULL::numeric,
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
  v_employee_code TEXT;
  v_invoice_number TEXT;
  v_settlement_invoice_id UUID;
  v_creator UUID;
  v_cash_result JSONB;
  v_total_amount NUMERIC := 0;
  v_resolved_profit_ids uuid[];
  v_resolved_order_ids uuid[];
  v_settled_orders jsonb;
BEGIN
  v_creator := COALESCE(p_paid_by, auth.uid());
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تحديد المستخدم (auth.uid = null)';
  END IF;

  SELECT full_name, employee_code INTO v_employee_name, v_employee_code
  FROM profiles WHERE user_id = p_employee_id;
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
    GROUP BY p.owner_user_id ORDER BY COUNT(*) DESC LIMIT 1;
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

  -- بناء snapshot كامل للطلبات
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'tracking_number', o.tracking_number,
    'customer_name', o.customer_name,
    'order_date', o.created_at,
    'order_total', COALESCE(o.final_amount, o.total_amount, 0),
    'delivery_fee', COALESCE(o.delivery_fee, 0),
    'discount', COALESCE(o.discount, 0),
    'price_increase', COALESCE(o.price_increase, 0),
    'employee_profit', COALESCE(pr.employee_profit, 0),
    'has_rule', EXISTS(SELECT 1 FROM employee_profit_rules epr WHERE epr.employee_id = pr.employee_id AND epr.is_active = true)
  )), '[]'::jsonb)
  INTO v_settled_orders
  FROM orders o
  LEFT JOIN profits pr ON pr.order_id = o.id AND pr.employee_id = p_employee_id
  WHERE o.id = ANY(v_resolved_order_ids);

  INSERT INTO settlement_invoices (
    invoice_number, employee_id, employee_name, employee_code, total_amount, settlement_date,
    description, order_ids, profit_ids, settled_orders, payment_method, status,
    notes, created_by, owner_user_id
  ) VALUES (
    v_invoice_number, p_employee_id, v_employee_name, v_employee_code, v_total_amount, now(),
    COALESCE(p_description, 'دفع مستحقات الموظف ' || v_employee_name),
    v_resolved_order_ids, v_resolved_profit_ids, v_settled_orders, 'cash', 'completed',
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
      'employee_code', v_employee_code,
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

  -- ربط الطلبات بالفاتورة مع profit_id والمبلغ الحقيقي لكل طلب
  INSERT INTO settlement_invoice_orders (settlement_invoice_id, order_id, profit_id, amount, created_at)
  SELECT v_settlement_invoice_id, p.order_id, p.id, COALESCE(p.employee_profit, 0), now()
  FROM profits p WHERE p.id = ANY(v_resolved_profit_ids)
  ON CONFLICT DO NOTHING;

  UPDATE orders SET isarchived = true, updated_at = now()
  WHERE id = ANY(v_resolved_order_ids);

  -- إشعار للموظف
  INSERT INTO notifications (user_id, type, title, message, data, is_read)
  VALUES (
    p_employee_id, 'settlement_completed',
    'تمت تسوية مستحقاتك 💰',
    'تم دفع مبلغ ' || v_total_amount::text || ' د.ع - فاتورة ' || v_invoice_number,
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'settlement_invoice_id', v_settlement_invoice_id,
      'amount', v_total_amount,
      'employee_id', p_employee_id,
      'employee_name', v_employee_name,
      'order_count', array_length(v_resolved_order_ids, 1),
      'settled_at', now()
    ),
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || v_employee_name || ' بنجاح',
    'invoice_number', v_invoice_number,
    'settlement_invoice_id', v_settlement_invoice_id,
    'amount', v_total_amount,
    'employee_name', v_employee_name,
    'employee_code', v_employee_code,
    'settlement_date', now(),
    'owner_user_id', v_resolved_owner,
    'cash_source_id', v_cash_source_id,
    'cash_source_name', v_cash_source_name,
    'cash_movement_id', v_cash_result->>'movement_id',
    'orders_count', array_length(v_resolved_order_ids, 1)
  );
END;
$function$;

-- 3) إصلاح فاتورة RY-3471D1 الحالية: employee_code + settled_orders + روابط الطلبات بالمبالغ
UPDATE settlement_invoices si
SET employee_code = pr.employee_code
FROM profiles pr
WHERE si.invoice_number = 'RY-3471D1' AND pr.user_id = si.employee_id AND si.employee_code IS NULL;

UPDATE settlement_invoices si
SET settled_orders = sub.settled_orders
FROM (
  SELECT si2.id,
    COALESCE(jsonb_agg(jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'tracking_number', o.tracking_number,
      'customer_name', o.customer_name,
      'order_date', o.created_at,
      'order_total', COALESCE(o.final_amount, o.total_amount, 0),
      'delivery_fee', COALESCE(o.delivery_fee, 0),
      'discount', COALESCE(o.discount, 0),
      'price_increase', COALESCE(o.price_increase, 0),
      'employee_profit', COALESCE(p.employee_profit, 0),
      'has_rule', true
    )), '[]'::jsonb) AS settled_orders
  FROM settlement_invoices si2
  LEFT JOIN orders o ON o.id = ANY(si2.order_ids)
  LEFT JOIN profits p ON p.order_id = o.id AND p.employee_id = si2.employee_id
  WHERE si2.invoice_number = 'RY-3471D1'
  GROUP BY si2.id
) sub
WHERE si.id = sub.id;

-- ربط روابط الطلبات بمبالغها وprofit_id
UPDATE settlement_invoice_orders sio
SET amount = COALESCE(p.employee_profit, 0), profit_id = p.id
FROM profits p, settlement_invoices si
WHERE sio.settlement_invoice_id = si.id
  AND si.invoice_number = 'RY-3471D1'
  AND p.order_id = sio.order_id
  AND p.employee_id = si.employee_id
  AND (sio.amount IS NULL OR sio.amount = 0 OR sio.profit_id IS NULL);

-- إنشاء إشعار للموظف بفاتورة RY-3471D1 إن لم يكن موجوداً
INSERT INTO notifications (user_id, type, title, message, data, is_read)
SELECT si.employee_id, 'settlement_completed', 'تمت تسوية مستحقاتك 💰',
  'تم دفع مبلغ ' || si.total_amount::text || ' د.ع - فاتورة ' || si.invoice_number,
  jsonb_build_object(
    'invoice_number', si.invoice_number,
    'settlement_invoice_id', si.id,
    'amount', si.total_amount,
    'employee_id', si.employee_id,
    'employee_name', si.employee_name,
    'order_count', COALESCE(array_length(si.order_ids,1),0),
    'settled_at', si.settlement_date
  ), false
FROM settlement_invoices si
WHERE si.invoice_number = 'RY-3471D1'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = si.employee_id
      AND n.type = 'settlement_completed'
      AND (n.data->>'settlement_invoice_id')::uuid = si.id
  );