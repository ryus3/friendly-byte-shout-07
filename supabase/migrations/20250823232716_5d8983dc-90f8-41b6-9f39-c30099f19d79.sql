-- إصلاح نظام الإشعارات: منع التكرار وإصلاح النصوص

-- 1. حذف الإشعارات المكررة من آخر 24 ساعة
DELETE FROM notifications 
WHERE type = 'order_status_changed' 
AND created_at > now() - interval '24 hours'
AND id NOT IN (
  SELECT DISTINCT ON (data->>'order_id', data->>'new_status') id
  FROM notifications 
  WHERE type = 'order_status_changed' 
  AND created_at > now() - interval '24 hours'
  ORDER BY data->>'order_id', data->>'new_status', created_at DESC
);

-- 2. إنشاء trigger محدث لمنع الإشعارات المكررة
CREATE OR REPLACE FUNCTION notify_alwaseet_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط عند تغيير الحالة فعلياً وليس عند الإنشاء الأولي
  IF TG_OP = 'UPDATE' AND OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
    
    -- التحقق من عدم وجود إشعار مماثل في آخر 5 دقائق
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE type = 'order_status_changed'
      AND data->>'order_id' = NEW.id::text
      AND data->>'new_status' = NEW.delivery_status
      AND created_at > now() - interval '5 minutes'
    ) THEN
      
      -- إرسال إشعار بالنص الحرفي من شركة التوصيل
      INSERT INTO notifications (
        title,
        message,
        type,
        priority,
        data,
        user_id
      ) VALUES (
        'تحديث حالة الطلب',
        COALESCE(NEW.tracking_number::text, NEW.order_number) || ' ' || NEW.delivery_status,
        'order_status_changed',
        CASE 
          WHEN NEW.delivery_status ILIKE '%تم التسليم%' OR NEW.delivery_status ILIKE '%delivered%' THEN 'high'
          WHEN NEW.delivery_status ILIKE '%في الطريق%' OR NEW.delivery_status ILIKE '%out for delivery%' THEN 'medium'
          ELSE 'low'
        END,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'old_status', OLD.delivery_status,
          'new_status', NEW.delivery_status,
          'customer_name', NEW.customer_name,
          'delivery_partner', NEW.delivery_partner
        ),
        NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ربط الـ trigger بجدول الطلبات
DROP TRIGGER IF EXISTS alwaseet_status_change_trigger ON orders;
CREATE TRIGGER alwaseet_status_change_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_alwaseet_status_change();

-- 4. إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_notifications_type_data_time 
ON notifications(type, ((data->>'order_id')), created_at);

-- 5. إنشاء constraint لمنع التكرار المستقبلي
CREATE UNIQUE INDEX IF NOT EXISTS unique_order_status_notifications 
ON notifications(type, ((data->>'order_id')), ((data->>'new_status'))) 
WHERE type = 'order_status_changed' AND created_at > now() - interval '1 hour';