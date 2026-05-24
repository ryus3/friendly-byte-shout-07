
-- إصلاح جذري للـ RLS على الفواتير لمنع infinite recursion

-- 1) دوال SECURITY DEFINER آمنة لا تسبب recursion
CREATE OR REPLACE FUNCTION public.user_can_see_invoice_owner(_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_deputy()
    OR _owner_user_id = auth.uid()
    OR _owner_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.employee_supervisors es
      WHERE es.supervisor_id = auth.uid()
        AND es.employee_id = _owner_user_id
        AND es.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_invoice(_invoice_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_invoices di
    WHERE di.id = _invoice_id
      AND (
        public.is_admin_or_deputy()
        OR di.owner_user_id = auth.uid()
        OR di.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.employee_supervisors es
          WHERE es.supervisor_id = auth.uid()
            AND es.employee_id = di.owner_user_id
            AND es.is_active = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.delivery_invoice_orders dio2
          JOIN public.orders o ON o.id = dio2.order_id
          WHERE dio2.invoice_id = di.id
            AND (
              o.created_by = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.employee_supervisors es2
                WHERE es2.supervisor_id = auth.uid()
                  AND es2.employee_id = o.created_by
                  AND es2.is_active = true
              )
            )
        )
      )
  );
$$;

-- 2) حذف السياسات الدائرية القديمة
DROP POLICY IF EXISTS "المستخدمون يرون فواتيرهم والمديرو" ON public.delivery_invoices;
DROP POLICY IF EXISTS "المستخدمون المصرح لهم يديرون الفو" ON public.delivery_invoices;
DROP POLICY IF EXISTS "المستخدمون يرون طلبات فواتيرهم وا" ON public.delivery_invoice_orders;
DROP POLICY IF EXISTS "المستخدمون المصرح لهم يديرون طلبا" ON public.delivery_invoice_orders;
DROP POLICY IF EXISTS "Authenticated can view delivery_invoice_orders" ON public.delivery_invoice_orders;
DROP POLICY IF EXISTS "invoices_select_scoped" ON public.delivery_invoices;
DROP POLICY IF EXISTS "invoices_manage_authenticated" ON public.delivery_invoices;
DROP POLICY IF EXISTS "invoice_orders_select_scoped" ON public.delivery_invoice_orders;
DROP POLICY IF EXISTS "invoice_orders_manage_authenticated" ON public.delivery_invoice_orders;

-- 3) سياسات نظيفة جديدة على delivery_invoices
CREATE POLICY "invoices_select_scoped"
ON public.delivery_invoices
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_deputy()
  OR owner_user_id = auth.uid()
  OR owner_user_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.employee_supervisors es
    WHERE es.supervisor_id = auth.uid()
      AND es.employee_id = delivery_invoices.owner_user_id
      AND es.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.delivery_partner_invoice_id = delivery_invoices.external_id
      AND COALESCE(o.delivery_partner, delivery_invoices.partner) = delivery_invoices.partner
      AND (
        o.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.employee_supervisors es2
          WHERE es2.supervisor_id = auth.uid()
            AND es2.employee_id = o.created_by
            AND es2.is_active = true
        )
      )
  )
);

CREATE POLICY "invoices_manage_authenticated"
ON public.delivery_invoices
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4) سياسات على delivery_invoice_orders تعتمد على دوال آمنة
CREATE POLICY "invoice_orders_select_scoped"
ON public.delivery_invoice_orders
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_deputy()
  OR owner_user_id = auth.uid()
  OR public.user_can_see_invoice_owner(owner_user_id)
  OR public.user_can_see_invoice(invoice_id)
);

CREATE POLICY "invoice_orders_manage_authenticated"
ON public.delivery_invoice_orders
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
