-- إضافة الأدوار الأساسية
INSERT INTO public.roles (name, display_name, description, hierarchy_level) VALUES
('super_admin', 'مدير عام', 'مدير النظام الذي يملك جميع الصلاحيات', 100),
('department_manager', 'مدير قسم', 'مدير قسم معين بصلاحيات إدارية محدودة', 80),
('sales_employee', 'موظف مبيعات', 'موظف مختص في المبيعات وإنشاء الطلبات', 50),
('warehouse_employee', 'موظف مخزن', 'موظف مختص في إدارة المخزون والجرد', 50),
('cashier', 'كاشير', 'موظف مختص في استلام المدفوعات', 40)
ON CONFLICT (name) DO NOTHING;

-- إضافة الصلاحيات الأساسية
INSERT INTO public.permissions (name, display_name, category, description) VALUES
-- صلاحيات عامة
('view_dashboard', 'عرض لوحة التحكم', 'عام', 'إمكانية الوصول للوحة التحكم الرئيسية'),
('view_all_data', 'عرض جميع البيانات', 'عام', 'إمكانية عرض جميع بيانات النظام'),

-- صلاحيات المنتجات
('view_products', 'عرض المنتجات', 'منتجات', 'إمكانية عرض قائمة المنتجات'),
('manage_products', 'إدارة المنتجات', 'منتجات', 'إضافة وتعديل وحذف المنتجات'),
('manage_variants', 'إدارة متغيرات المنتجات', 'منتجات', 'إدارة الألوان والأحجام والتصنيفات'),

-- صلاحيات المخزون
('view_inventory', 'عرض المخزون', 'مخزون', 'إمكانية عرض حالة المخزون'),
('manage_inventory', 'إدارة المخزون', 'مخزون', 'تعديل كميات المخزون'),
('use_barcode_scanner', 'استخدام ماسح الباركود', 'مخزون', 'إمكانية استخدام ماسح الباركود'),

-- صلاحيات الطلبات
('view_orders', 'عرض الطلبات', 'طلبات', 'إمكانية عرض الطلبات الشخصية'),
('view_all_orders', 'عرض جميع الطلبات', 'طلبات', 'إمكانية عرض جميع طلبات النظام'),
('create_orders', 'إنشاء طلبات', 'طلبات', 'إمكانية إنشاء طلبات جديدة'),
('edit_orders', 'تعديل الطلبات', 'طلبات', 'إمكانية تعديل الطلبات الموجودة'),
('quick_order', 'الطلب السريع', 'طلبات', 'إمكانية استخدام نظام الطلب السريع'),
('view_ai_orders', 'عرض الطلبات الذكية', 'طلبات', 'إمكانية عرض طلبات الذكاء الاصطناعي'),

-- صلاحيات المشتريات
('view_purchases', 'عرض المشتريات', 'مشتريات', 'إمكانية عرض فواتير الشراء'),
('manage_purchases', 'إدارة المشتريات', 'مشتريات', 'إضافة وتعديل فواتير الشراء'),

-- صلاحيات الأرباح والمحاسبة
('view_own_profits', 'عرض الأرباح الشخصية', 'أرباح', 'إمكانية عرض الأرباح الشخصية'),
('view_all_profits', 'عرض جميع الأرباح', 'أرباح', 'إمكانية عرض أرباح جميع الموظفين'),
('view_accounting', 'عرض المحاسبة', 'محاسبة', 'إمكانية عرض التقارير المحاسبية'),
('manage_finances', 'إدارة الشؤون المالية', 'محاسبة', 'إدارة المعاملات المالية والمصاريف'),
('manage_profit_settlement', 'إدارة تحاسب الأرباح', 'أرباح', 'مراجعة والموافقة على طلبات تحاسب الأرباح'),

-- صلاحيات الموظفين
('manage_employees', 'إدارة الموظفين', 'موظفين', 'إضافة وتعديل وإدارة الموظفين'),
('view_settings', 'عرض الإعدادات', 'إعدادات', 'إمكانية الوصول لصفحة الإعدادات')
ON CONFLICT (name) DO NOTHING;

-- ربط صلاحيات المدير العام
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r 
CROSS JOIN public.permissions p 
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- ربط صلاحيات مدير القسم
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p 
WHERE r.name = 'department_manager' 
AND p.name IN (
    'view_dashboard', 'view_products', 'manage_products', 'view_inventory', 'manage_inventory',
    'view_all_orders', 'create_orders', 'edit_orders', 'view_ai_orders', 'view_purchases',
    'view_all_profits', 'view_accounting', 'manage_profit_settlement', 'view_settings'
)
ON CONFLICT DO NOTHING;

-- ربط صلاحيات موظف المبيعات
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p 
WHERE r.name = 'sales_employee' 
AND p.name IN (
    'view_dashboard', 'view_products', 'view_orders', 'create_orders', 
    'quick_order', 'view_own_profits', 'view_settings'
)
ON CONFLICT DO NOTHING;

-- ربط صلاحيات موظف المخزن
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p 
WHERE r.name = 'warehouse_employee' 
AND p.name IN (
    'view_dashboard', 'view_products', 'view_inventory', 'manage_inventory',
    'use_barcode_scanner', 'view_orders', 'view_purchases', 'manage_purchases', 'view_settings'
)
ON CONFLICT DO NOTHING;

-- ربط صلاحيات الكاشير
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM public.roles r, public.permissions p 
WHERE r.name = 'cashier' 
AND p.name IN (
    'view_dashboard', 'view_orders', 'create_orders', 'quick_order', 'view_settings'
)
ON CONFLICT DO NOTHING;