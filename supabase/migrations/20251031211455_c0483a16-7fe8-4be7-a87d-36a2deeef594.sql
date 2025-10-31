-- إضافة حقل selected_delivery_partner في جدول profiles لحفظ الشركة الافتراضية
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS selected_delivery_partner TEXT DEFAULT 'alwaseet';

-- إضافة تعليق للحقل
COMMENT ON COLUMN profiles.selected_delivery_partner IS 'الشركة الافتراضية المحددة من قبل المستخدم (modon أو alwaseet)';