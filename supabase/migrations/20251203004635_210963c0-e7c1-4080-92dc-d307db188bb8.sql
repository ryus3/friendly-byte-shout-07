-- إضافة حقل الهاشتاقات لجدول employee_product_descriptions
ALTER TABLE employee_product_descriptions
ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';