
-- إضافة صلاحية مدير القسم لرؤية فواتير موظفيه
-- تحديث سياسة SELECT على delivery_invoices

DROP POLICY IF EXISTS "المستخدمون يرون فواتيرهم والمديرو" ON public.delivery_invoices;

CREATE POLICY "المستخدمون يرون فواتيرهم والمديرو" ON public.delivery_invoices
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    owner_user_id = auth.uid() 
    OR is_admin_or_deputy() 
    OR owner_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM employee_supervisors es
      WHERE es.supervisor_id = auth.uid()
        AND es.employee_id = owner_user_id
        AND es.is_active = true
    )
  )
);

-- تحديث سياسة SELECT على delivery_invoice_orders

DROP POLICY IF EXISTS "المستخدمون يرون طلبات فواتيرهم وا" ON public.delivery_invoice_orders;

CREATE POLICY "المستخدمون يرون طلبات فواتيرهم وا" ON public.delivery_invoice_orders
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
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
  )
);
