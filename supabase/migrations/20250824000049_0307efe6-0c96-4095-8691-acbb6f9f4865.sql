-- إصلاح التريغر لإشعارات تغيير حالة الطلب
-- حذف التريغر القديم إن وُجد
DROP TRIGGER IF EXISTS notify_order_status_change ON orders;
DROP FUNCTION IF EXISTS notify_order_status_change();

-- إنشاء دالة التريغر المحسنة
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط عند تغيير delivery_status
  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status AND NEW.delivery_status IS NOT NULL THEN
    -- التحقق من عدم وجود إشعار مطابق في آخر 5 دقائق لمنع التكرار
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE type = 'order_status_changed'
      AND data->>'order_id' = NEW.id::text
      AND data->>'new_status' = NEW.delivery_status
      AND created_at > now() - INTERVAL '5 minutes'
    ) THEN
      -- إنشاء الإشعار بالبيانات الصحيحة
      INSERT INTO notifications (
        title,
        message,
        type,
        user_id,
        data,
        priority
      ) VALUES (
        'تحديث حالة الطلب',
        'تم تحديث حالة الطلب ' || COALESCE(NEW.tracking_number, NEW.order_number) || ' إلى: ' || NEW.delivery_status,
        'order_status_changed',
        NEW.created_by,
        jsonb_build_object(
          'order_id', NEW.id,
          'tracking_number', NEW.tracking_number,
          'order_number', NEW.order_number,
          'old_status', OLD.delivery_status,
          'new_status', NEW.delivery_status,
          'delivery_status', NEW.delivery_status,
          'customer_name', NEW.customer_name,
          'customer_phone', NEW.customer_phone
        ),
        'normal'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء التريغر الجديد
CREATE TRIGGER notify_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();