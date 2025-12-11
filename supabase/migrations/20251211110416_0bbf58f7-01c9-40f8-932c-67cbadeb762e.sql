-- إضافة الأعمدة المفقودة إلى جدول product_tracking_log
ALTER TABLE product_tracking_log 
ADD COLUMN IF NOT EXISTS quantity_change INTEGER DEFAULT 0;

ALTER TABLE product_tracking_log 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'system';

ALTER TABLE product_tracking_log 
ADD COLUMN IF NOT EXISTS reference_id UUID;