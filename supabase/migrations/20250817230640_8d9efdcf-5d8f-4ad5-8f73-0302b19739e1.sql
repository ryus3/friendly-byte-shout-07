-- Apply the remaining security policies now that functions exist

-- SECURE CASH MOVEMENTS (Financial admins only)
DROP POLICY IF EXISTS "Authenticated users can manage cash movements" ON public.cash_movements;

CREATE POLICY "Only financial admins can manage cash movements"
ON public.cash_movements
FOR ALL
USING (is_financial_admin())
WITH CHECK (is_financial_admin());

-- SECURE ORDERS TABLE - Critical customer data protection
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;

CREATE POLICY "Employees can view orders they created"
ON public.orders
FOR SELECT
USING (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  -- Allow assigned staff to see orders assigned to them
  (assigned_to = auth.uid() AND assigned_to IS NOT NULL)
);

CREATE POLICY "Users can create orders"
ON public.orders
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own orders or assigned orders"
ON public.orders
FOR UPDATE
USING (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  (assigned_to = auth.uid() AND assigned_to IS NOT NULL)
)
WITH CHECK (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  (assigned_to = auth.uid() AND assigned_to IS NOT NULL)
);

CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (is_admin_or_deputy());

-- Add security audit table and function
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only security admins can view audit logs"
ON public.security_audit_log
FOR SELECT
USING (is_admin_or_deputy());

CREATE OR REPLACE FUNCTION public.log_sensitive_access(
    p_action text,
    p_table_name text,
    p_record_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.security_audit_log (
        user_id,
        action,
        table_name,
        record_id
    ) VALUES (
        auth.uid(),
        p_action,
        p_table_name,
        p_record_id
    );
END;
$$;