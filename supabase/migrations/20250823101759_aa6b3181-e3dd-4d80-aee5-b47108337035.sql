-- إنشاء دالة trigger لأرشفة الطلبات تلقائياً عند تسوية الأرباح
CREATE OR REPLACE FUNCTION public.auto_archive_completed_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- عندما يتم تحديث الربح إلى settled، قم بأرشفة الطلب تلقائياً
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    UPDATE orders 
    SET isarchived = true, updated_at = now()
    WHERE id = NEW.order_id 
    AND status = 'completed' 
    AND receipt_received = true
    AND isarchived != true;
    
    RAISE NOTICE 'تم أرشفة الطلب % تلقائياً بعد تسوية الأرباح', NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ربط الـ trigger بجدول profits
DROP TRIGGER IF EXISTS trigger_auto_archive_completed_orders ON profits;
CREATE TRIGGER trigger_auto_archive_completed_orders
  AFTER UPDATE ON profits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_completed_orders();

-- تحديث الطلبات الموجودة التي تمت تسويتها ولم تُؤرشف بعد
UPDATE orders 
SET isarchived = true, updated_at = now()
WHERE status = 'completed' 
AND receipt_received = true 
AND isarchived != true
AND id IN (
  SELECT DISTINCT order_id 
  FROM profits 
  WHERE status = 'settled' 
  AND settled_at IS NOT NULL
);