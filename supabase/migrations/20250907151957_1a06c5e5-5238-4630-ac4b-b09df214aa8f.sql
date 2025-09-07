-- إضافة صلاحية view_stock_alerts للمستخدم أحمد
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.role_id, p.id
FROM user_roles ur
JOIN permissions p ON p.name = 'view_stock_alerts'
WHERE ur.user_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid
  AND ur.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = ur.role_id AND rp.permission_id = p.id
  );