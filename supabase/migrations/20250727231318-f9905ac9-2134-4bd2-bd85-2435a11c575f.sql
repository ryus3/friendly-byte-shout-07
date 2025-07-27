-- إضافة صلاحية عرض الأرباح الشخصية للموظفين
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('sales_employee', 'warehouse_employee', 'cashier', 'department_manager')
AND p.name = 'view_own_profits'
AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);