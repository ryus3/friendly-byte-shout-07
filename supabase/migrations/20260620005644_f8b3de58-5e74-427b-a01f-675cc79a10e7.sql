
-- ============================================================
-- PART 1: Recompute all delivered orders' profits using the real calculator
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_calc jsonb;
BEGIN
  FOR r IN
    SELECT o.id
    FROM public.orders o
    WHERE o.status IN ('delivered','completed')
  LOOP
    v_calc := public.calculate_real_employee_profit_for_order(r.id);
    IF (v_calc->>'exists')::boolean = true AND (v_calc->>'employee_id') IS NOT NULL THEN
      UPDATE public.profits
      SET
        employee_profit = COALESCE((v_calc->>'employee_profit')::numeric, 0),
        profit_amount   = COALESCE((v_calc->>'profit_amount')::numeric, 0),
        total_revenue   = COALESCE((v_calc->>'total_revenue')::numeric, 0),
        total_cost      = COALESCE((v_calc->>'total_cost')::numeric, 0),
        updated_at      = now()
      WHERE order_id = r.id;
    END IF;
  END LOOP;
END$$;

-- ============================================================
-- PART 2: Employee product reservations (allocated stock per employee)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_product_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  sold_quantity integer NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL,
  owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, variant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_product_reservations TO authenticated;
GRANT ALL ON public.employee_product_reservations TO service_role;

ALTER TABLE public.employee_product_reservations ENABLE ROW LEVEL SECURITY;

-- View policies
CREATE POLICY "Admins see all reservations"
ON public.employee_product_reservations FOR SELECT
TO authenticated
USING (public.is_admin_or_deputy());

CREATE POLICY "Product owner sees reservations for owned products"
ON public.employee_product_reservations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = employee_product_reservations.product_id
      AND p.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Employee sees own reservations"
ON public.employee_product_reservations FOR SELECT
TO authenticated
USING (employee_id = auth.uid());

-- Manage policies (insert/update/delete)
CREATE POLICY "Admins manage all reservations"
ON public.employee_product_reservations FOR ALL
TO authenticated
USING (public.is_admin_or_deputy())
WITH CHECK (public.is_admin_or_deputy());

CREATE POLICY "Product owner manages reservations for owned products"
ON public.employee_product_reservations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = employee_product_reservations.product_id
      AND p.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = employee_product_reservations.product_id
      AND p.owner_user_id = auth.uid()
  )
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_employee_reservation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.owner_user_id IS NULL THEN
    SELECT p.owner_user_id INTO NEW.owner_user_id FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_touch_employee_reservation ON public.employee_product_reservations;
CREATE TRIGGER trg_touch_employee_reservation
BEFORE INSERT OR UPDATE ON public.employee_product_reservations
FOR EACH ROW EXECUTE FUNCTION public.touch_employee_reservation();

-- ============================================================
-- PART 3: Helper functions
-- ============================================================

-- Returns remaining quantity an employee can sell from THEIR personal reservation
-- (reserved - sold). Returns NULL if no active reservation exists (means unrestricted).
CREATE OR REPLACE FUNCTION public.get_employee_reserved_remaining(
  p_employee_id uuid,
  p_variant_id uuid
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.employee_product_reservations
      WHERE employee_id = p_employee_id
        AND variant_id = p_variant_id
        AND is_active = true
    )
    THEN COALESCE((
      SELECT GREATEST(0, reserved_quantity - sold_quantity)
      FROM public.employee_product_reservations
      WHERE employee_id = p_employee_id
        AND variant_id = p_variant_id
        AND is_active = true
      LIMIT 1
    ), 0)
    ELSE NULL
  END;
$$;

-- Returns whether a given variant has ANY active reservation by another employee
-- (used to block non-reserved employees from selling reserved stock)
CREATE OR REPLACE FUNCTION public.variant_has_other_reservation(
  p_employee_id uuid,
  p_variant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_product_reservations
    WHERE variant_id = p_variant_id
      AND is_active = true
      AND employee_id <> p_employee_id
      AND reserved_quantity > sold_quantity
  );
$$;

-- ============================================================
-- PART 4: Auto-adjust sold_quantity on order item lifecycle
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_employee_reservation_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator uuid;
  v_old_status text;
  v_new_status text;
  v_qty integer;
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
AFTER INSERT OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_reservation_on_order_item();

-- When an order is fully returned (status returned/cancelled), release the sold count back
CREATE OR REPLACE FUNCTION public.release_employee_reservation_on_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_was_active boolean;
  v_now_returned boolean;
BEGIN
  v_was_active := COALESCE(OLD.status, '') NOT IN ('returned','cancelled','returned_in_stock');
  v_now_returned := COALESCE(NEW.status, '') IN ('returned','cancelled','returned_in_stock')
                  OR COALESCE(NEW.delivery_status, '') = '17';
  IF v_was_active AND v_now_returned AND NEW.created_by IS NOT NULL THEN
    UPDATE public.employee_product_reservations r
    SET sold_quantity = GREATEST(0, r.sold_quantity - oi.quantity)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variant_id = r.variant_id
      AND r.employee_id = NEW.created_by
      AND r.is_active = true;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_release_emp_reservation_on_return ON public.orders;
CREATE TRIGGER trg_release_emp_reservation_on_return
AFTER UPDATE OF status, delivery_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_employee_reservation_on_return();

-- ============================================================
-- PART 5: Helpful index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_emp_reservations_employee_variant
  ON public.employee_product_reservations(employee_id, variant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_emp_reservations_owner
  ON public.employee_product_reservations(owner_user_id);
