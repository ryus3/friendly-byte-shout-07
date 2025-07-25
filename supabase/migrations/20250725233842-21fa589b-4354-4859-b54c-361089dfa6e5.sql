-- إضافة صلاحية إدارة العملاء
INSERT INTO permissions (name, display_name, description, category) VALUES 
('view_customers', 'عرض العملاء', 'صلاحية عرض وإدارة بيانات العملاء ونظام الولاء', 'customer_management');

-- إضافة الصلاحية للأدمن والمديرين
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('super_admin', 'admin', 'department_manager') 
AND p.name = 'view_customers'
ON CONFLICT (role_id, permission_id) DO NOTHING;