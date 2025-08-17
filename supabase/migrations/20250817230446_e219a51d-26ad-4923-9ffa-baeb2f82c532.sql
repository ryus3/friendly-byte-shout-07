-- CRITICAL SECURITY FIXES: Implementing Role-Based Access Control (Fixed)

-- First, create more granular security functions (if they don't exist)
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

-- SECURE PROFILES TABLE (Employee Data) - Drop existing policies first
DROP POLICY IF EXISTS "Safe admin access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "HR admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_hr_admin());

CREATE POLICY "Users can update own profile only"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
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
DROP POLICY IF EXISTS "المستخدمون يرون معاملاتهم المالية" ON public.financial_transactions;
DROP POLICY IF EXISTS "Financial transactions viewable by authenticated users" ON public.financial_transactions;

CREATE POLICY "Only financial admins can manage financial transactions"
ON public.financial_transactions
FOR ALL
USING (is_financial_admin())
WITH CHECK (is_financial_admin());

CREATE POLICY "Users can view their own financial transactions"
ON public.financial_transactions
FOR SELECT
USING (created_by = auth.uid() OR is_financial_admin());

-- SECURE ORDERS TABLE - Critical customer data protection
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;

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