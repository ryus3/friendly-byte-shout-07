-- إضافة حقل phone إلى جدول profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;