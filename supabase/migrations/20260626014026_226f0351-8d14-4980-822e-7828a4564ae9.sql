
-- =========================================================
-- (1) RESERVATION TRIGGERS: handle INSERT/UPDATE/DELETE properly
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_employee_reservation_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator uuid;
  v_old_qty integer;
  v_new_qty integer;
  v_delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT created_by INTO v_creator FROM public.orders WHERE id = NEW.order_id;
    IF v_creator IS NOT NULL AND NEW.variant_id IS NOT NULL THEN
      UPDATE public.employee_product_reservations
      SET sold_quantity = sold_quantity + COALESCE(NEW.quantity, 0)
      WHERE employee_id = v_creator
        AND variant_id = NEW.variant_id
        AND is_active = true;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- handle quantity change and variant swap
    SELECT created_by INTO v_creator FROM public.orders WHERE id = NEW.order_id;
    IF v_creator IS NULL THEN
      RETURN NEW;
    END IF;

    IF COALESCE(OLD.variant_id::text,'') <> COALESCE(NEW.variant_id::text,'') THEN
      -- variant swap: release old, consume new
      IF OLD.variant_id IS NOT NULL THEN
        UPDATE public.employee_product_reservations
        SET sold_quantity = GREATEST(0, sold_quantity - COALESCE(OLD.quantity, 0))
        WHERE employee_id = v_creator
          AND variant_id = OLD.variant_id
          AND is_active = true;
      END IF;
      IF NEW.variant_id IS NOT NULL THEN
        UPDATE public.employee_product_reservations
        SET sold_quantity = sold_quantity + COALESCE(NEW.quantity, 0)
        WHERE employee_id = v_creator
          AND variant_id = NEW.variant_id
          AND is_active = true;
      END IF;
    ELSE
      v_delta := COALESCE(NEW.quantity,0) - COALESCE(OLD.quantity,0);
      IF v_delta <> 0 AND NEW.variant_id IS NOT NULL THEN
        UPDATE public.employee_product_reservations
        SET sold_quantity = GREATEST(0, sold_quantity + v_delta)
        WHERE employee_id = v_creator
          AND variant_id = NEW.variant_id
          AND is_active = true;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT created_by INTO v_creator FROM public.orders WHERE id = OLD.order_id;
    IF v_creator IS NOT NULL AND OLD.variant_id IS NOT NULL THEN
      UPDATE public.employee_product_reservations
      SET sold_quantity = GREATEST(0, sold_quantity - COALESCE(OLD.quantity, 0))
      WHERE employee_id = v_creator
        AND variant_id = OLD.variant_id
        AND is_active = true;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_emp_reservation_oi ON public.order_items;
CREATE TRIGGER trg_sync_emp_reservation_oi
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_reservation_on_order_item();

-- =========================================================
-- (2) UPSERT helper: preserves sold_quantity & is_active
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_employee_reservation(
  p_employee_id uuid,
  p_product_id  uuid,
  p_variant_id  uuid,
  p_reserved_quantity integer,
  p_created_by  uuid,
  p_owner_user_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS public.employee_product_reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.employee_product_reservations;
  v_owner uuid;
  v_is_owner boolean := false;
  v_is_admin boolean := public.is_admin_or_deputy();
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.products WHERE id = p_product_id;
  v_is_owner := (v_owner IS NOT NULL AND v_owner = auth.uid());

  IF NOT v_is_admin AND NOT v_is_owner THEN
    RAISE EXCEPTION 'not_authorized_to_reserve';
  END IF;

  INSERT INTO public.employee_product_reservations(
    employee_id, product_id, variant_id, reserved_quantity,
    sold_quantity, is_active, notes, created_by, owner_user_id
  ) VALUES (
    p_employee_id, p_product_id, p_variant_id, GREATEST(0, COALESCE(p_reserved_quantity,0)),
    0, true, p_notes, p_created_by, COALESCE(p_owner_user_id, v_owner)
  )
  ON CONFLICT (employee_id, variant_id) DO UPDATE
  SET reserved_quantity = GREATEST(0, COALESCE(EXCLUDED.reserved_quantity,0)),
      is_active = true,
      notes = COALESCE(EXCLUDED.notes, public.employee_product_reservations.notes),
      owner_user_id = COALESCE(public.employee_product_reservations.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;$$;

GRANT EXECUTE ON FUNCTION public.upsert_employee_reservation(uuid,uuid,uuid,integer,uuid,uuid,text) TO authenticated;

-- =========================================================
-- (3) variant_has_other_reservation: skip admins & owners
-- =========================================================
CREATE OR REPLACE FUNCTION public.variant_has_other_reservation(
  p_employee_id uuid,
  p_variant_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product_owner uuid;
BEGIN
  -- admins/deputies bypass
  IF public.is_admin_or_deputy() THEN
    RETURN false;
  END IF;

  -- product owner bypass
  SELECT p.owner_user_id INTO v_product_owner
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE pv.id = p_variant_id;

  IF v_product_owner IS NOT NULL AND v_product_owner = COALESCE(p_employee_id, auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.employee_product_reservations
    WHERE variant_id = p_variant_id
      AND is_active = true
      AND employee_id <> COALESCE(p_employee_id, auth.uid())
      AND reserved_quantity > sold_quantity
  );
END;$$;

-- =========================================================
-- (4) get_invoice_profits_report: include partial delivery fields
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_invoice_profits_report(p_invoice_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := is_admin_or_deputy();
  v_orders jsonb;
  v_items jsonb;
  v_profits jsonb;
  v_rules jsonb;
  v_names jsonb;
  v_allowed_count int;
  v_total_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_total_count FROM delivery_invoices WHERE id = ANY(p_invoice_ids);
    SELECT COUNT(*) INTO v_allowed_count
    FROM delivery_invoices di
    WHERE di.id = ANY(p_invoice_ids)
      AND (
        di.owner_user_id = v_caller
        OR EXISTS (
          SELECT 1 FROM employee_supervisors es
          WHERE es.supervisor_id = v_caller
            AND es.is_active = true
            AND es.employee_id = di.owner_user_id
        )
        OR EXISTS (
          SELECT 1 FROM delivery_invoice_orders dio
          JOIN orders o ON o.id = dio.order_id
          WHERE dio.invoice_id = di.id AND o.created_by = v_caller
        )
        OR EXISTS (
          SELECT 1 FROM delivery_invoice_orders dio
          JOIN orders o ON o.id = dio.order_id
          JOIN employee_supervisors es ON es.employee_id = o.created_by
          WHERE dio.invoice_id = di.id AND es.supervisor_id = v_caller AND es.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM delivery_invoice_orders dio
          JOIN order_items oi ON oi.order_id = dio.order_id
          JOIN products p ON p.id = oi.product_id
          WHERE dio.invoice_id = di.id AND p.owner_user_id = v_caller
        )
      );
    IF v_allowed_count <> v_total_count THEN
      RAISE EXCEPTION 'not_owner';
    END IF;
  END IF;

  WITH order_ids AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
  )
  SELECT jsonb_agg(to_jsonb(o)) INTO v_orders
  FROM (
    SELECT o.id, o.created_by, o.final_amount, o.total_amount, o.delivery_fee,
           o.order_type, o.status, o.delivery_status
    FROM orders o WHERE o.id IN (SELECT order_id FROM order_ids)
  ) o;

  SELECT jsonb_agg(jsonb_build_object(
    'order_id', oi.order_id,
    'product_id', oi.product_id,
    'variant_id', oi.variant_id,
    'quantity', oi.quantity,
    'quantity_delivered', oi.quantity_delivered,
    'quantity_returned', oi.quantity_returned,
    'item_status', oi.item_status,
    'item_direction', oi.item_direction,
    'unit_price', oi.unit_price,
    'total_price', oi.total_price,
    'products', jsonb_build_object('id', p.id, 'name', p.name, 'owner_user_id', p.owner_user_id, 'cost_price', p.cost_price),
    'product_variants', CASE WHEN pv.id IS NULL THEN NULL ELSE jsonb_build_object('id', pv.id, 'cost_price', pv.cost_price) END
  )) INTO v_items
  FROM order_items oi
  LEFT JOIN products p ON p.id = oi.product_id
  LEFT JOIN product_variants pv ON pv.id = oi.variant_id
  WHERE oi.order_id IN (
    SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
  );

  SELECT jsonb_agg(to_jsonb(pr)) INTO v_profits
  FROM (
    SELECT order_id, employee_id, employee_profit, profit_amount, total_revenue, total_cost, status
    FROM profits
    WHERE order_id IN (
      SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    )
  ) pr;

  SELECT jsonb_agg(DISTINCT er.employee_id) INTO v_rules
  FROM employee_profit_rules er
  WHERE er.is_active = true
    AND er.employee_id IN (
      SELECT DISTINCT o.created_by FROM orders o
      WHERE o.id IN (
        SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
        WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
      ) AND o.created_by IS NOT NULL
    );

  SELECT jsonb_object_agg(p.user_id, COALESCE(p.full_name, p.username, '')) INTO v_names
  FROM profiles p
  WHERE p.user_id IN (
    SELECT DISTINCT o.created_by FROM orders o
    WHERE o.id IN (
      SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    ) AND o.created_by IS NOT NULL
    UNION
    SELECT DISTINCT p2.owner_user_id FROM order_items oi JOIN products p2 ON p2.id=oi.product_id
    WHERE oi.order_id IN (
      SELECT DISTINCT dio.order_id FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = ANY(p_invoice_ids) AND dio.order_id IS NOT NULL
    ) AND p2.owner_user_id IS NOT NULL
  );

  RETURN jsonb_build_object(
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'orderItems', COALESCE(v_items, '[]'::jsonb),
    'profits', COALESCE(v_profits, '[]'::jsonb),
    'employeesWithRules', COALESCE(v_rules, '[]'::jsonb),
    'namesMap', COALESCE(v_names, '{}'::jsonb)
  );
END;
$function$;
