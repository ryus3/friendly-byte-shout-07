-- ربط المستخدمين الحاليين بالأدوار الجديدة
INSERT INTO public.user_roles (user_id, role_id, assigned_by, is_active)
SELECT 
  p.user_id,
  CASE 
    WHEN p.role = 'admin' THEN (SELECT id FROM public.roles WHERE name = 'super_admin')
    WHEN p.role = 'deputy' THEN (SELECT id FROM public.roles WHERE name = 'department_manager')  
    WHEN p.role = 'warehouse' THEN (SELECT id FROM public.roles WHERE name = 'warehouse_employee')
    WHEN p.role = 'employee' THEN (SELECT id FROM public.roles WHERE name = 'sales_employee')
    ELSE (SELECT id FROM public.roles WHERE name = 'sales_employee') -- افتراضي
  END as role_id,
  (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1) as assigned_by,
  true as is_active
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT user_id FROM public.user_roles)
AND p.is_active = true;

-- تحديث صلاحيات الأدوار
-- صلاحيات المدير العام
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'super_admin'),
  p.id
FROM public.permissions p
WHERE p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- صلاحيات مدير القسم
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'department_manager'),
  p.id
FROM public.permissions p
WHERE p.name IN (
  'view_dashboard', 'manage_products', 'manage_inventory', 'create_orders', 
  'view_orders', 'manage_customers', 'view_reports', 'manage_purchases',
  'view_profits', 'view_employees', 'manage_variants'
) AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- صلاحيات موظف المبيعات
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'sales_employee'),
  p.id
FROM public.permissions p
WHERE p.name IN (
  'view_dashboard', 'view_products', 'create_orders', 'view_orders',
  'view_customers', 'view_inventory', 'view_profits_own'
) AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- صلاحيات موظف المخزن
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'warehouse_employee'),
  p.id
FROM public.permissions p
WHERE p.name IN (
  'view_dashboard', 'view_products', 'manage_inventory', 'view_orders',
  'manage_purchases', 'view_reports'
) AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;