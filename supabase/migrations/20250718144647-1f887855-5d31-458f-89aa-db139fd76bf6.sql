-- إضافة صلاحية تطبيق خصومات على الطلبات
INSERT INTO public.permissions (id, name, display_name, description, category) 
VALUES (
  gen_random_uuid(),
  'apply_order_discounts',
  'تطبيق خصومات على الطلبات',
  'صلاحية تطبيق خصومات على الطلبات وخصمها من أرباح الموظف',
  'orders'
) ON CONFLICT (name) DO NOTHING;

-- إضافة الصلاحية لدور المدير العام
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'super_admin' 
AND p.name = 'apply_order_discounts'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- إضافة الصلاحية لدور موظف المبيعات
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'sales_employee' 
AND p.name = 'apply_order_discounts'
ON CONFLICT (role_id, permission_id) DO NOTHING;