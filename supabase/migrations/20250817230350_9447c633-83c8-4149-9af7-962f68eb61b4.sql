-- CRITICAL SECURITY FIXES: Implementing Role-Based Access Control

-- First, create more granular security functions
CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin', 'hr_admin')
    AND ur.is_active = true
    AND r.is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_financial_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin', 'financial_admin', 'deputy_admin')
    AND ur.is_active = true
    AND r.is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_customers()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    is_admin_or_deputy() OR 
    check_user_permission(auth.uid(), 'manage_all_customers') OR
    check_user_permission(auth.uid(), 'view_all_customers')
  );
END;
$$;

-- SECURE CUSTOMERS TABLE
DROP POLICY IF EXISTS "المديرون يديرون جميع العملاء" ON public.customers;
DROP POLICY IF EXISTS "الموظفون يرون عملاءهم" ON public.customers;

CREATE POLICY "Admins and authorized users can manage all customers"
ON public.customers
FOR ALL
USING (can_manage_customers())
WITH CHECK (can_manage_customers());

CREATE POLICY "Employees can only see their own customers"
ON public.customers
FOR SELECT
USING (
  created_by = auth.uid() OR 
  can_manage_customers()
);

CREATE POLICY "Employees can create customers"
ON public.customers
FOR INSERT
WITH CHECK (created_by = auth.uid());

-- SECURE PROFILES TABLE (Employee Data)
DROP POLICY IF EXISTS "Safe admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own or admins view all" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "HR admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_hr_admin());

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR admins can manage all profiles"
ON public.profiles
FOR ALL
USING (is_hr_admin())
WITH CHECK (is_hr_admin());

-- SECURE FINANCIAL TABLES
-- Financial Transactions
DROP POLICY IF EXISTS "Financial transactions manageable by authenticated users" ON public.financial_transactions;
DROP POLICY IF EXISTS "المديرون يديرون المعاملات المالية" ON public.financial_transactions;

CREATE POLICY "Only financial admins can manage financial transactions"
ON public.financial_transactions
FOR ALL
USING (is_financial_admin())
WITH CHECK (is_financial_admin());

CREATE POLICY "Users can view their own financial transactions"
ON public.financial_transactions
FOR SELECT
USING (created_by = auth.uid() OR is_financial_admin());

-- Expenses
DROP POLICY IF EXISTS "المستخدمون ينشئون المصاريف" ON public.expenses;
DROP POLICY IF EXISTS "المستخدمون يرون مصاريفهم" ON public.expenses;

CREATE POLICY "Users can create expenses"
ON public.expenses
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view their own expenses"
ON public.expenses
FOR SELECT
USING (created_by = auth.uid() OR is_financial_admin());

CREATE POLICY "Financial admins can approve expenses"
ON public.expenses
FOR UPDATE
USING (is_financial_admin());

-- Cash Movements (Financial admins only)
DROP POLICY IF EXISTS "Authenticated users can manage cash movements" ON public.cash_movements;

CREATE POLICY "Only financial admins can manage cash movements"
ON public.cash_movements
FOR ALL
USING (is_financial_admin())
WITH CHECK (is_financial_admin());

-- SECURE ORDERS TABLE
-- This is critical as it contains customer purchase history
CREATE POLICY "Employees can view orders they created"
ON public.orders
FOR SELECT
USING (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  -- Allow delivery staff to see orders assigned to them
  (delivery_employee_id = auth.uid() AND delivery_employee_id IS NOT NULL)
);

CREATE POLICY "Users can create orders"
ON public.orders
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own orders or assigned delivery orders"
ON public.orders
FOR UPDATE
USING (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  (delivery_employee_id = auth.uid() AND delivery_employee_id IS NOT NULL)
)
WITH CHECK (
  created_by = auth.uid() OR 
  is_admin_or_deputy() OR
  (delivery_employee_id = auth.uid() AND delivery_employee_id IS NOT NULL)
);

-- SECURE TELEGRAM CODES (Personal Communication Data)
DROP POLICY IF EXISTS "المستخدمون يديرون أكواد التليغرام" ON public.employee_telegram_codes;

CREATE POLICY "Users can only access their own telegram codes"
ON public.employee_telegram_codes
FOR ALL
USING (user_id = auth.uid() OR is_admin_or_deputy())
WITH CHECK (user_id = auth.uid() OR is_admin_or_deputy());

-- Add audit trail for sensitive data access
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

-- Function to log sensitive data access
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