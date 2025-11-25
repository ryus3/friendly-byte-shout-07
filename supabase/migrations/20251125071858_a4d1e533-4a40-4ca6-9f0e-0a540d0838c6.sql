-- إصلاح Foreign Key لـ employee_storefront_settings
-- حذف الـ Foreign Key الخاطئ الذي يشير إلى auth.users
ALTER TABLE employee_storefront_settings
DROP CONSTRAINT IF EXISTS employee_storefront_settings_employee_id_fkey;

-- إضافة الـ Foreign Key الصحيح إلى profiles.user_id
ALTER TABLE employee_storefront_settings
ADD CONSTRAINT employee_storefront_settings_employee_id_fkey
FOREIGN KEY (employee_id)
REFERENCES profiles(user_id)
ON DELETE CASCADE;

-- إضافة index للأداء
CREATE INDEX IF NOT EXISTS idx_employee_storefront_employee_id 
ON employee_storefront_settings(employee_id);

-- إضافة تعليق توضيحي
COMMENT ON CONSTRAINT employee_storefront_settings_employee_id_fkey 
ON employee_storefront_settings 
IS 'Foreign key linking storefront settings to employee profile (profiles.user_id)';