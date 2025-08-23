-- إنشاء trigger لتحديث حالة الطلبات تلقائياً عند تسوية الأرباح
CREATE OR REPLACE FUNCTION public.auto_complete_orders_on_profit_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- عندما يتم تسوية الربح وكانت الفاتورة مُستلمة، قم بإكمال الطلب وأرشفته
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    UPDATE orders 
    SET 
      status = 'completed',
      isarchived = true,
      updated_at = now()
    WHERE id = NEW.order_id 
    AND receipt_received = true
    AND status IN ('delivered', 'shipped', 'pending') -- فقط للطلبات التي لم تكن مكتملة
    AND isarchived = false;
    
    -- تسجيل في الإشعارات
    IF FOUND THEN
      INSERT INTO notifications (
        title,
        message,
        type,
        priority,
        data,
        user_id
      ) VALUES (
        'تم إكمال الطلب تلقائياً',
        'تم إكمال وأرشفة الطلب تلقائياً بعد تسوية الأرباح واستلام الفاتورة',
        'order_completed',
        'medium',
        jsonb_build_object(
          'order_id', NEW.order_id,
          'profit_id', NEW.id,
          'auto_completed', true
        ),
        NEW.employee_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء trigger
DROP TRIGGER IF EXISTS trigger_auto_complete_orders_on_profit_settlement ON profits;
CREATE TRIGGER trigger_auto_complete_orders_on_profit_settlement
  AFTER UPDATE ON profits
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_orders_on_profit_settlement();

-- إصلاح البيانات الموجودة: الطلبات المُسلّمة مع فواتير مُستلمة وأرباح مُسوّاة
UPDATE orders 
SET 
  status = 'completed',
  isarchived = true,
  updated_at = now()
WHERE id IN (
  SELECT DISTINCT o.id
  FROM orders o
  JOIN profits p ON o.id = p.order_id
  WHERE o.status = 'delivered'
  AND o.receipt_received = true
  AND p.status = 'settled'
  AND o.isarchived = false
);

-- تحديث settled_at للأرباح المُسوّاة التي لا تحتوي على تاريخ تسوية
UPDATE profits 
SET 
  settled_at = CASE 
    WHEN status = 'settled' AND settled_at IS NULL THEN updated_at
    ELSE settled_at
  END,
  updated_at = now()
WHERE status = 'settled' AND settled_at IS NULL;