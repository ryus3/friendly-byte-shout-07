-- Create security functions first
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