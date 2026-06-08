-- Fix: SELECT DISTINCT with ORDER BY COALESCE(...) requires the expression in select list.
-- Wrap in subquery to make ordering safe and keep distinct invoices.
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
      SELECT * FROM (
        SELECT di.* FROM delivery_invoices di
        WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
          AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
      ) x
      ORDER BY COALESCE(x.received_at, x.issued_at, x.created_at) DESC;
    RETURN;
  END IF;

  IF p_scope = 'active_accounts' THEN
    RETURN QUERY
      SELECT * FROM (
        SELECT DISTINCT di.* FROM delivery_invoices di
        WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
          AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
          AND di.account_username IS NOT NULL AND di.account_username <> ''
          AND EXISTS (
            SELECT 1 FROM delivery_partner_tokens t
            WHERE t.user_id = v_caller AND t.is_active = true
              AND t.partner_name = di.partner
              AND lower(coalesce(t.normalized_username, t.account_username)) =
                  lower(coalesce(di.account_username, ''))
          )
      ) x
      ORDER BY COALESCE(x.received_at, x.issued_at, x.created_at) DESC;
    RETURN;
  END IF;

  IF p_scope = 'employees' AND p_employees IS NOT NULL AND array_length(p_employees,1) > 0 THEN
    IF NOT v_is_admin THEN
      IF EXISTS (
        SELECT unnest(p_employees) emp
        EXCEPT
        (SELECT es.employee_id FROM employee_supervisors es
          WHERE es.supervisor_id = v_caller AND es.is_active = true
         UNION SELECT v_caller)
      ) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
    END IF;
    RETURN QUERY
      SELECT * FROM (
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
            OR EXISTS (
              SELECT 1 FROM orders o
              WHERE o.delivery_partner_invoice_id = di.external_id
                AND COALESCE(o.delivery_partner, di.partner) = di.partner
                AND o.created_by = ANY(p_employees)
            )
          )
      ) x
      ORDER BY COALESCE(x.received_at, x.issued_at, x.created_at) DESC;
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
      SELECT * FROM (
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
            OR EXISTS (
              SELECT 1 FROM orders o
              WHERE o.delivery_partner_invoice_id = di.external_id
                AND COALESCE(o.delivery_partner, di.partner) = di.partner
                AND o.created_by = p_employee
            )
          )
      ) x
      ORDER BY COALESCE(x.received_at, x.issued_at, x.created_at) DESC;
    RETURN;
  END IF;

  IF p_scope = 'managed' THEN
    RETURN QUERY
      SELECT * FROM (
        SELECT DISTINCT di.* FROM delivery_invoices di
        WHERE COALESCE(di.issued_at, di.received_at, di.created_at) >= p_from
          AND COALESCE(di.issued_at, di.received_at, di.created_at) <= p_to
          AND (
            di.owner_user_id IN (
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
      ) x
      ORDER BY COALESCE(x.received_at, x.issued_at, x.created_at) DESC;
    RETURN;
  END IF;

  -- default 'self'
  RETURN QUERY
    SELECT * FROM (
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
    ) x
    ORDER BY COALESCE(x.received_at, x.issued_at, x.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_invoices_for_report(timestamptz, timestamptz, text, uuid, uuid[]) TO authenticated;