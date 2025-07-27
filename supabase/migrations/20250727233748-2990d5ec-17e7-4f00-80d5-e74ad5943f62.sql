-- إضافة صلاحية طلب تحاسب الأرباح
INSERT INTO public.permissions (name, display_name, description, category, is_active) 
VALUES ('request_profit_settlement', 'طلب تحاسب الأرباح', 'السماح للموظف بطلب تحاسب أرباحه المعلقة', 'الأرباح', true)
ON CONFLICT (name) DO NOTHING;

-- ربط الصلاحية بدور موظف المبيعات
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id as role_id,
  p.id as permission_id
FROM public.roles r, public.permissions p 
WHERE r.name = 'sales_employee' 
AND p.name = 'request_profit_settlement'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ربط الصلاحية بدور الموظف العادي أيضاً
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id as role_id,
  p.id as permission_id
FROM public.roles r, public.permissions p 
WHERE r.name = 'employee' 
AND p.name = 'request_profit_settlement'
ON CONFLICT (role_id, permission_id) DO NOTHING;