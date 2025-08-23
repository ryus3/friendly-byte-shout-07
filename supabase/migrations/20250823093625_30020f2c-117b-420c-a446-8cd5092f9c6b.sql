-- إصلاح منطق التحاسب: أرشفة الطلبات المتسواة سابقاً
UPDATE orders 
SET is_archived = true,
    updated_at = now()
WHERE status = 'completed' 
AND receipt_received = true 
AND is_archived = false
AND id IN (
  SELECT DISTINCT order_id 
  FROM profits 
  WHERE status = 'settled' 
  AND settled_at IS NOT NULL
);

-- إنشاء دالة أتمتة الأرشفة التلقائية عند التسوية
CREATE OR REPLACE FUNCTION auto_archive_settled_orders()
RETURNS trigger AS $$
BEGIN
  -- عندما يتم تحديث الربح إلى settled، قم بأرشفة الطلب
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    UPDATE orders 
    SET is_archived = true, updated_at = now()
    WHERE id = NEW.order_id 
    AND status = 'completed' 
    AND receipt_received = true
    AND is_archived = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- إنشاء trigger للأرشفة التلقائية
DROP TRIGGER IF EXISTS trigger_auto_archive_on_settlement ON profits;
CREATE TRIGGER trigger_auto_archive_on_settlement
  AFTER UPDATE ON profits
  FOR EACH ROW
  WHEN (NEW.status = 'settled' AND OLD.status != 'settled')
  EXECUTE FUNCTION auto_archive_settled_orders();

-- دالة لتنظيف ومراجعة حالة الأرشفة
CREATE OR REPLACE FUNCTION review_archive_status()
RETURNS void AS $$
BEGIN
  -- أرشفة أي طلبات متسواة لم تُؤرشف بعد
  UPDATE orders 
  SET is_archived = true, updated_at = now()
  WHERE status = 'completed' 
  AND receipt_received = true 
  AND is_archived = false
  AND id IN (
    SELECT DISTINCT order_id 
    FROM profits 
    WHERE status = 'settled' 
    AND settled_at IS NOT NULL
  );
  
  RAISE NOTICE 'تم مراجعة وتحديث حالة الأرشفة للطلبات المتسواة';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';