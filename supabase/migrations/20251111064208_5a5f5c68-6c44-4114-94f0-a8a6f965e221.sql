-- إضافة حقول معلومات الأعمال إلى جدول profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_page_name TEXT,
ADD COLUMN IF NOT EXISTS business_links JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb;

-- تحديث comment للجدول
COMMENT ON COLUMN public.profiles.business_name IS 'اسم النشاط التجاري للموظف';
COMMENT ON COLUMN public.profiles.business_page_name IS 'اسم الصفحة التجارية';
COMMENT ON COLUMN public.profiles.business_links IS 'روابط الأنشطة التجارية (JSONB array)';
COMMENT ON COLUMN public.profiles.social_media IS 'روابط وسائل التواصل الاجتماعي (JSONB object)';