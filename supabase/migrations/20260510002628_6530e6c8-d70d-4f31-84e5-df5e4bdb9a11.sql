-- Extend delivery_invoices SELECT policy to include users whose linked local orders are inside the invoice
DROP POLICY IF EXISTS "المستخدمون يرون فواتيرهم والمديرو" ON public.delivery_invoices;

CREATE POLICY "المستخدمون يرون فواتيرهم والمديرو"
ON public.delivery_invoices
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid()
    OR is_admin_or_deputy()
    OR owner_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM employee_supervisors es
      WHERE es.supervisor_id = auth.uid()
        AND es.employee_id = delivery_invoices.owner_user_id
        AND es.is_active = true
    )
    -- ✅ Shared delivery account: user can see invoice if one of their local orders is linked to it
    OR EXISTS (
      SELECT 1
      FROM delivery_invoice_orders dio
      JOIN orders o ON o.id = dio.order_id
      WHERE dio.invoice_id = delivery_invoices.id
        AND o.created_by = auth.uid()
    )
    -- ✅ Department manager: can see invoice if any supervised employee's order is linked
    OR EXISTS (
      SELECT 1
      FROM delivery_invoice_orders dio
      JOIN orders o ON o.id = dio.order_id
      JOIN employee_supervisors es ON es.employee_id = o.created_by
      WHERE dio.invoice_id = delivery_invoices.id
        AND es.supervisor_id = auth.uid()
        AND es.is_active = true
    )
  )
);

-- Same logic for delivery_invoice_orders rows
DROP POLICY IF EXISTS "المستخدمون يرون طلبات فواتيرهم وا" ON public.delivery_invoice_orders;

CREATE POLICY "المستخدمون يرون طلبات فواتيرهم وا"
ON public.delivery_invoice_orders
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid()
    OR is_admin_or_deputy()
    OR owner_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM delivery_invoices di
      JOIN employee_supervisors es ON es.employee_id = di.owner_user_id
      WHERE di.id = delivery_invoice_orders.invoice_id
        AND es.supervisor_id = auth.uid()
        AND es.is_active = true
    )
    -- ✅ Shared delivery account: user owns the local order linked to this dio row
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = delivery_invoice_orders.order_id
        AND o.created_by = auth.uid()
    )
    -- ✅ Department manager: supervised employee owns the linked local order
    OR EXISTS (
      SELECT 1 FROM orders o
      JOIN employee_supervisors es ON es.employee_id = o.created_by
      WHERE o.id = delivery_invoice_orders.order_id
        AND es.supervisor_id = auth.uid()
        AND es.is_active = true
    )
  )
);