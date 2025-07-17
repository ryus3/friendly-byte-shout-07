-- إضافة صلاحيات مفقودة للأدوار الموجودة
-- Adding missing permissions for existing roles

-- صلاحيات موظف المبيعات (Sales Employee)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales_employee' 
AND p.name IN (
    'view_products',
    'create_orders', 
    'view_orders',
    'view_customers',
    'create_customers',
    'view_profits',
    'view_inventory'
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- صلاحيات موظف المخزن (Warehouse Employee)  
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'warehouse_employee'
AND p.name IN (
    'view_products',
    'manage_inventory',
    'view_inventory', 
    'view_purchases',
    'create_purchases',
    'view_orders'
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- صلاحيات الكاشير (Cashier)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'cashier'
AND p.name IN (
    'view_products',
    'create_orders',
    'view_orders', 
    'view_customers',
    'create_customers',
    'process_payments'
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- صلاحيات منسق التوصيل (Delivery Coordinator)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'delivery_coordinator'
AND p.name IN (
    'view_orders',
    'update_delivery_status',
    'view_customers'
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- التأكد من وجود صلاحية process_payments
INSERT INTO permissions (name, display_name, description, category, is_active)
VALUES (
    'process_payments',
    'معالجة المدفوعات', 
    'القدرة على معالجة المدفوعات والفواتير',
    'financial',
    true
)
ON CONFLICT (name) DO NOTHING;

-- التأكد من وجود صلاحية update_delivery_status
INSERT INTO permissions (name, display_name, description, category, is_active)
VALUES (
    'update_delivery_status',
    'تحديث حالة التوصيل',
    'القدرة على تحديث حالة توصيل الطلبات',
    'orders',
    true
)
ON CONFLICT (name) DO NOTHING;