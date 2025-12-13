-- تحديث دالة is_admin_or_deputy لتشمل department_manager
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'super_admin', 'deputy_admin', 'department_manager')
      AND ur.is_active = true
  )
$$;