-- Phase 1: حذف triggers المعطلة وإضافة حقول profiles الجديدة

-- 1.1 حذف trigger المعطل الثاني
DROP TRIGGER IF EXISTS trigger_process_returned_inventory ON orders;
DROP FUNCTION IF EXISTS process_returned_order_inventory();

-- 1.2 إضافة حقول جديدة لجدول profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_page_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_code TEXT;

COMMENT ON COLUMN profiles.business_name IS 'اسم النشاط التجاري';
COMMENT ON COLUMN profiles.business_page_name IS 'اسم الصفحة التجارية';
COMMENT ON COLUMN profiles.business_links IS 'روابط الأنشطة التجارية - مصفوفة من {type, url, title}';
COMMENT ON COLUMN profiles.social_media IS 'روابط وسائل التواصل الاجتماعي - {facebook, instagram, twitter, etc}';
COMMENT ON COLUMN profiles.employee_code IS 'معرف الموظف الفريد';