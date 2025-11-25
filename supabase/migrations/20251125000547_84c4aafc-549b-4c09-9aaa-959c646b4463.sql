-- إضافة الحقول القانونية الأربعة فقط إلى employee_storefront_settings
ALTER TABLE employee_storefront_settings 
ADD COLUMN IF NOT EXISTS about_us TEXT,
ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
ADD COLUMN IF NOT EXISTS return_policy TEXT;

-- التأكد من وجود Foreign Key للربط مع profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'employee_storefront_settings_employee_id_fkey'
    AND table_name = 'employee_storefront_settings'
  ) THEN
    ALTER TABLE employee_storefront_settings
    ADD CONSTRAINT employee_storefront_settings_employee_id_fkey 
    FOREIGN KEY (employee_id) 
    REFERENCES profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN employee_storefront_settings.about_us IS 'محتوى صفحة "من نحن" - محرر نص غني';
COMMENT ON COLUMN employee_storefront_settings.privacy_policy IS 'محتوى صفحة "سياسة الخصوصية" - محرر نص غني';
COMMENT ON COLUMN employee_storefront_settings.terms_conditions IS 'محتوى صفحة "الشروط والأحكام" - محرر نص غني';
COMMENT ON COLUMN employee_storefront_settings.return_policy IS 'محتوى صفحة "سياسة الاسترجاع" - محرر نص غني';