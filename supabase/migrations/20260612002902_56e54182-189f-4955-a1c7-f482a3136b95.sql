
-- =====================================================
-- Phase A: عمود is_root_storefront للمتجر الجذر
-- =====================================================
ALTER TABLE public.employee_storefront_settings
  ADD COLUMN IF NOT EXISTS is_root_storefront boolean NOT NULL DEFAULT false;

-- ضمان وجود متجر جذر واحد فقط
CREATE UNIQUE INDEX IF NOT EXISTS uniq_root_storefront_true
  ON public.employee_storefront_settings ((is_root_storefront))
  WHERE is_root_storefront = true;

-- =====================================================
-- Phase B: تحديث trigger الأرباح ليضمّن الزيادة (price_increase)
-- نفس المنطق السابق لكن:
--   • إذا كان للموظف قاعدة ربح → يُضاف priceIncrease لربح الموظف ويُخصم الخصم
--   • تقسيم نسبي عند وجود بنود بقاعدة وبنود بدون قاعدة (مثل الخصم)
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS TRIGGER
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

    -- المرور الأول: تصنيف البنود (بقاعدة / بدون)
    FOR v_item IN
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      v_item_price := COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity, 0);

      SELECT EXISTS(
        SELECT 1 FROM employee_profit_rules
        WHERE employee_id = v_employee_id
          AND is_active = true
          AND (
            (rule_type = 'product' AND target_id = v_item.product_id::text)
            OR (rule_type = 'variant' AND target_id = v_item.variant_id::text)
          )
          AND created_at <= NEW.created_at
      ) INTO v_has_rule;

      IF v_has_rule THEN
        v_items_with_rules_total := v_items_with_rules_total + v_item_price;
      ELSE
        v_items_without_rules_total := v_items_without_rules_total + v_item_price;
      END IF;
    END LOOP;

    -- توزيع نسبي للخصم والزيادة بين البنود بقاعدة / بدون
    IF (v_items_with_rules_total + v_items_without_rules_total) > 0 THEN
      v_discount_for_rules    := v_order_discount * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_discount_for_no_rules := v_order_discount * (v_items_without_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_increase_for_rules    := v_order_increase * (v_items_with_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
      v_increase_for_no_rules := v_order_increase * (v_items_without_rules_total / (v_items_with_rules_total + v_items_without_rules_total));
    ELSIF v_items_with_rules_total > 0 THEN
      v_discount_for_rules := v_order_discount;
      v_increase_for_rules := v_order_increase;
    END IF;

    -- المرور الثاني: التكاليف وربح الموظف من القواعد
    FOR v_item IN
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      SELECT COALESCE(pv.cost_price, p.cost_price, 0) INTO v_item_cost
      FROM products p
      LEFT JOIN product_variants pv ON pv.id = v_item.variant_id
      WHERE p.id = v_item.product_id;

      v_total_cost := v_total_cost + (COALESCE(v_item_cost, 0) * v_item.quantity);

      SELECT profit_amount, profit_percentage INTO v_item_profit, v_item_percentage
      FROM employee_profit_rules
      WHERE employee_id = v_employee_id
        AND is_active = true
        AND (
          (rule_type = 'product' AND target_id = v_item.product_id::text)
          OR (rule_type = 'variant' AND target_id = v_item.variant_id::text)
        )
        AND created_at <= NEW.created_at
      ORDER BY
        CASE rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END
      LIMIT 1;

      IF COALESCE(v_item_percentage, 0) = 100 THEN
        v_employee_profit := v_employee_profit + GREATEST(0, (COALESCE(v_item.unit_price, 0) - COALESCE(v_item_cost, 0)) * v_item.quantity);
      ELSE
        v_employee_profit := v_employee_profit + (COALESCE(v_item_profit, 0) * v_item.quantity);
      END IF;
    END LOOP;

    v_profit_amount := v_total_revenue - v_total_cost;

    -- ✨ تطبيق الزيادة والخصم على ربح الموظف (للبنود بقاعدة فقط)
    v_employee_profit := v_employee_profit + v_increase_for_rules - v_discount_for_rules;

    IF v_employee_profit < 0 THEN
      v_employee_profit := 0;
    END IF;

    -- تسجيل خصم معلّق للبنود بدون قاعدة (سلوك سابق)
    IF v_discount_for_no_rules > 0 THEN
      INSERT INTO employee_pending_deductions (
        employee_id, order_id, amount, reason, status, created_at
      ) VALUES (
        v_employee_id, NEW.id, v_discount_for_no_rules,
        'خصم نسبي على منتجات بدون قاعدة ربح - طلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
        'pending', NOW()
      );
    END IF;

    IF v_employee_profit = 0 THEN
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
      CASE WHEN v_employee_profit = 0 THEN NOW() ELSE NULL END, NOW(), NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = CASE
        WHEN EXCLUDED.employee_profit = 0 THEN 'no_rule_archived'
        WHEN NEW.receipt_received THEN 'invoice_received'
        ELSE profits.status
      END,
      settled_at = CASE
        WHEN EXCLUDED.employee_profit = 0 THEN NOW()
        ELSE profits.settled_at
      END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================
-- Phase C: باك-فِل للأرباح غير المسددة لإصلاح ربح الموظف
-- =====================================================
WITH order_calc AS (
  SELECT
    o.id AS order_id,
    o.created_by AS employee_id,
    o.created_at,
    COALESCE(o.discount, 0) AS order_discount,
    COALESCE(o.price_increase, 0) AS order_increase,
    -- تجميع البنود بقاعدة وبدون قاعدة
    COALESCE(SUM(CASE WHEN epr.id IS NOT NULL THEN COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0) ELSE 0 END), 0) AS with_rules_total,
    COALESCE(SUM(CASE WHEN epr.id IS NULL    THEN COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0) ELSE 0 END), 0) AS no_rules_total,
    -- ربح القاعدة (دون زيادة/خصم)
    COALESCE(SUM(
      CASE
        WHEN epr.id IS NULL THEN 0
        WHEN COALESCE(epr.profit_percentage, 0) = 100
          THEN GREATEST(0, (COALESCE(oi.unit_price, 0) - COALESCE(pv.cost_price, p.cost_price, 0)) * oi.quantity)
        ELSE COALESCE(epr.profit_amount, 0) * oi.quantity
      END
    ), 0) AS base_profit
  FROM orders o
  JOIN profits pr ON pr.order_id = o.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN product_variants pv ON pv.id = oi.variant_id
  LEFT JOIN LATERAL (
    SELECT epr.id, epr.profit_amount, epr.profit_percentage
    FROM employee_profit_rules epr
    WHERE epr.employee_id = o.created_by
      AND epr.is_active = true
      AND (
        (epr.rule_type = 'product' AND epr.target_id = oi.product_id::text)
        OR (epr.rule_type = 'variant' AND epr.target_id = oi.variant_id::text)
      )
      AND epr.created_at <= o.created_at
    ORDER BY CASE epr.rule_type WHEN 'variant' THEN 1 WHEN 'product' THEN 2 ELSE 3 END
    LIMIT 1
  ) epr ON true
  WHERE pr.status IN ('pending', 'invoice_received', 'settlement_requested')
    AND o.delivery_status = '4'
  GROUP BY o.id, o.created_by, o.created_at, o.discount, o.price_increase
)
UPDATE profits pr
SET employee_profit = GREATEST(0,
      oc.base_profit
      + CASE
          WHEN (oc.with_rules_total + oc.no_rules_total) > 0
            THEN oc.order_increase * (oc.with_rules_total / NULLIF(oc.with_rules_total + oc.no_rules_total, 0))
          WHEN oc.with_rules_total > 0 THEN oc.order_increase
          ELSE 0
        END
      - CASE
          WHEN (oc.with_rules_total + oc.no_rules_total) > 0
            THEN oc.order_discount * (oc.with_rules_total / NULLIF(oc.with_rules_total + oc.no_rules_total, 0))
          WHEN oc.with_rules_total > 0 THEN oc.order_discount
          ELSE 0
        END
    ),
    updated_at = now()
FROM order_calc oc
WHERE pr.order_id = oc.order_id
  AND oc.base_profit > 0;
