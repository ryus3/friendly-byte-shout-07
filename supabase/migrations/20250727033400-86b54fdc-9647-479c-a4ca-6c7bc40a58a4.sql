-- إضافة صلاحية إدارة العملاء للموظفين
INSERT INTO public.permissions (name, display_name, description, category) VALUES
('manage_all_customers', 'إدارة جميع العملاء', 'عرض وإدارة جميع بيانات العملاء', 'customers'),
('manage_own_customers', 'إدارة العملاء الشخصيين', 'عرض وإدارة العملاء الذين أنشأهم الموظف فقط', 'customers')
ON CONFLICT (name) DO NOTHING;