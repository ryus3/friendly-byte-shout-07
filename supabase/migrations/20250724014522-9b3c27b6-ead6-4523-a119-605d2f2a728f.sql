-- إضافة الأعمدة المفقودة لجدول النسخ الاحتياطي
ALTER TABLE public.system_backups 
ADD COLUMN IF NOT EXISTS tables_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_records INTEGER DEFAULT 0;

-- تحديث القيم الموجودة للأعمدة الجديدة
UPDATE public.system_backups 
SET tables_count = 20, total_records = 0 
WHERE tables_count IS NULL;