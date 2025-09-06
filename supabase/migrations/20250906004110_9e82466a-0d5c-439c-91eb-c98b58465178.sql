-- إضافة صلاحية عرض تنبيهات المخزون
INSERT INTO permissions (name, display_name, category, description)
VALUES 
  ('view_stock_alerts', 'عرض تنبيهات المخزون', 'المخزون', 'إمكانية عرض التنبيهات الخاصة بالمخزون المنخفض'),
  ('manage_inventory_full', 'إدارة المخزون كاملة', 'المخزون', 'صلاحية كاملة لإدارة المخزون والتنبيهات')
ON CONFLICT (name) DO NOTHING;

-- إضافة cron extension إذا لم تكن موجودة
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;