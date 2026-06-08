
-- Extend get_visible_invoices_for_report to support 'active_accounts' (current user's active partner tokens)
-- and 'employees' (multiple employee_ids array). Keeps existing scopes intact.
CREATE OR REPLACE FUNCTION public.get_visible_invoices_for_report(
  p_from timestamptz,
  p_to timestamptz,
  p_scope text DEFAULT 'self',
  p_employee uuid DEFAULT NULL,
  p_employees uuid[] DEFAULT NULL
)
RETURNS SETOF public.delivery_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := is_admin_or_deputy();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF p_scope = 'all' THEN
    IF NOT v_is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;
    RETURN QUERY
      SELECT di.* FROM delivery_invoices di
      WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
        AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
      ORDER BY COALESCE(di.received_at, di.issued_at, di.created_at) DESC;
    RETURN;
  END IF;

  -- NEW: current active delivery accounts of the caller (alwaseet/modon usernames)
  IF p_scope = 'active_accounts' THEN
    RETURN QUERY
      SELECT DISTINCT di.* FROM delivery_invoices di
      WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
        AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
        AND EXISTS (
          SELECT 1 FROM delivery_partner_tokens t
          WHERE t.user_id = v_caller AND t.is_active = true
            AND t.partner_name = di.partner
            AND lower(coalesce(t.normalized_username, t.account_username)) =
                lower(coalesce(di.account_username, ''))
            AND di.account_username IS NOT NULL AND di.account_username <> ''
        )
      ORDER BY COALESCE(di.received_at, di.issued_at, di.created_at) DESC;
    RETURN;
  END IF;

  -- NEW: multiple employees (admin or supervisor of all of them)
  IF p_scope = 'employees' AND p_employees IS NOT NULL AND array_length(p_employees,1) > 0 THEN
    IF NOT v_is_admin THEN
      IF EXISTS (
        SELECT unnest(p_employees) emp
        EXCEPT
        SELECT es.employee_id FROM employee_supervisors es
        WHERE es.supervisor_id = v_caller AND es.is_active = true
        UNION SELECT v_caller
      ) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
    END IF;
    RETURN QUERY
      SELECT DISTINCT di.* FROM delivery_invoices di
      WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
        AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
        AND (
          di.owner_user_id = ANY(p_employees)
          OR EXISTS (
            SELECT 1 FROM delivery_invoice_orders dio
            JOIN orders o ON o.id = dio.order_id
            WHERE dio.invoice_id = di.id AND o.created_by = ANY(p_employees)
          )
        )
      ORDER BY COALESCE(di.received_at, di.issued_at, di.created_at) DESC;
    RETURN;
  END IF;

  IF p_scope = 'employee' AND p_employee IS NOT NULL THEN
    IF NOT v_is_admin AND NOT EXISTS (
      SELECT 1 FROM employee_supervisors es
      WHERE es.supervisor_id = v_caller AND es.is_active = true AND es.employee_id = p_employee
    ) AND p_employee <> v_caller THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    RETURN QUERY
      SELECT DISTINCT di.* FROM delivery_invoices di
      WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
        AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
        AND (
          di.owner_user_id = p_employee
          OR EXISTS (
            SELECT 1 FROM delivery_invoice_orders dio
            JOIN orders o ON o.id = dio.order_id
            WHERE dio.invoice_id = di.id AND o.created_by = p_employee
          )
        )
      ORDER BY COALESCE(di.received_at, di.issued_at, di.created_at) DESC;
    RETURN;
  END IF;

  IF p_scope = 'managed' THEN
    RETURN QUERY
      SELECT DISTINCT di.* FROM delivery_invoices di
      WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
        AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
        AND (
          di.owner_user_id = v_caller
          OR di.owner_user_id IN (
            SELECT es.employee_id FROM employee_supervisors es
            WHERE es.supervisor_id = v_caller AND es.is_active = true
          )
          OR EXISTS (
            SELECT 1 FROM delivery_invoice_orders dio
            JOIN orders o ON o.id = dio.order_id
            JOIN employee_supervisors es ON es.employee_id = o.created_by
            WHERE dio.invoice_id = di.id AND es.supervisor_id = v_caller AND es.is_active = true
          )
        )
      ORDER BY COALESCE(di.received_at, di.issued_at, di.created_at) DESC;
    RETURN;
  END IF;

  -- default 'self'
  RETURN QUERY
    SELECT DISTINCT di.* FROM delivery_invoices di
    WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
      AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
      AND (
        di.owner_user_id = v_caller
        OR EXISTS (
          SELECT 1 FROM delivery_invoice_orders dio
          JOIN orders o ON o.id = dio.order_id
          WHERE dio.invoice_id = di.id AND o.created_by = v_caller
        )
      )
    ORDER BY COALESCE(di.received_at, di.issued_at, di.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_invoices_for_report(timestamptz, timestamptz, text, uuid, uuid[]) TO authenticated;
