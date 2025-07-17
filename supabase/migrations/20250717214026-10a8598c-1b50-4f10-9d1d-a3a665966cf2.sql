-- RLS policies for permissions
CREATE POLICY "allow_user_read_roles" ON public.user_roles
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "allow_user_read_role_permissions" ON public.role_permissions
  FOR SELECT 
  TO authenticated
  USING (role_id IN (
    SELECT role_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND is_active = true
  ));

CREATE POLICY "allow_user_read_permissions" ON public.permissions
  FOR SELECT 
  TO authenticated
  USING (id IN (
    SELECT permission_id 
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid() 
    AND ur.is_active = true
  ));

-- RLS policies for user product permissions
CREATE POLICY "allow_user_read_product_permissions" ON public.user_product_permissions
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

-- Add missing permissions if they don't exist
INSERT INTO public.permissions (name, display_name, category)
VALUES 
('view_accounting', 'عرض المحاسبة', 'accounting'),
('manage_accounting', 'إدارة المحاسبة', 'accounting'),
('view_finances', 'عرض المالية', 'finances'),
('manage_finances', 'إدارة المالية', 'finances')
ON CONFLICT (name) DO NOTHING;

-- Ensure default role has necessary permissions
WITH default_role AS (
  SELECT id FROM public.roles WHERE name = 'super_admin' LIMIT 1
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM default_role),
  p.id
FROM public.permissions p
WHERE p.name IN ('view_accounting', 'manage_accounting', 'view_finances', 'manage_finances')
ON CONFLICT (role_id, permission_id) DO NOTHING;