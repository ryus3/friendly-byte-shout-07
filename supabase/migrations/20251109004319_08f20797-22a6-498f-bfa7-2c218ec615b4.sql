-- المرحلة 1: إضافة حقل status_changed_at لتتبع آخر تغيير في الحالة
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- تحديث جميع الطلبات الحالية بقيمة updated_at
UPDATE orders 
SET status_changed_at = updated_at 
WHERE status_changed_at IS NULL;

-- Trigger لتحديث status_changed_at تلقائياً عند تغيير الحالة
CREATE OR REPLACE FUNCTION update_order_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- التحديث فقط عند تغيير status أو delivery_status
  IF (OLD.status IS DISTINCT FROM NEW.status) OR 
     (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    NEW.status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء Trigger
DROP TRIGGER IF EXISTS trigger_update_order_status_changed_at ON orders;
CREATE TRIGGER trigger_update_order_status_changed_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_changed_at();

-- فهرس لتحسين الأداء عند الترتيب حسب status_changed_at
CREATE INDEX IF NOT EXISTS idx_orders_status_changed_at ON orders(status_changed_at DESC);