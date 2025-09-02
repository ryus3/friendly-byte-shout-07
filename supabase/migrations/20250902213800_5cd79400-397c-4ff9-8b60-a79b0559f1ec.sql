-- إضافة حقل updated_at إلى جدول notifications إذا لم يكن موجوداً
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- إضافة حقل related_entity_id إذا لم يكن موجوداً
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS related_entity_id TEXT;

-- إنشاء فهرس للبحث السريع على related_entity_id و type
CREATE INDEX IF NOT EXISTS idx_notifications_related_entity 
ON public.notifications(related_entity_id, type) 
WHERE related_entity_id IS NOT NULL;

-- إنشاء trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();