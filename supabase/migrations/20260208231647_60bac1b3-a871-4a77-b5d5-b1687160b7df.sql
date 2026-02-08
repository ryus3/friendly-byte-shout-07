-- إضافة عمود delivery_partner لتمييز بين مزامنة الوسيط ومدن
ALTER TABLE cities_regions_sync_log 
ADD COLUMN IF NOT EXISTS delivery_partner TEXT DEFAULT 'alwaseet';

-- تحديث السجلات القديمة
UPDATE cities_regions_sync_log 
SET delivery_partner = 'alwaseet' 
WHERE delivery_partner IS NULL;

-- إنشاء index للبحث السريع بالشريك
CREATE INDEX IF NOT EXISTS idx_cities_regions_sync_log_partner 
ON cities_regions_sync_log(delivery_partner, success, ended_at DESC);