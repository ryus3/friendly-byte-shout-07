-- تحسين trigger الإشعارات لحالات الوسيط
-- هذا التحديث يضمن إشعارات دقيقة وغير مكررة

-- إنشاء دالة محسنة للإشعارات
CREATE OR REPLACE FUNCTION notify_alwaseet_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  status_text TEXT;
  notification_message TEXT;
  existing_notification_id UUID;
BEGIN
  -- فقط للطلبات التي تستخدم الوسيط
  IF LOWER(COALESCE(NEW.delivery_partner, '')) != 'alwaseet' THEN
    RETURN NEW;
  END IF;

  -- فقط عند تغيير delivery_status الفعلي
  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- تحديد النص المناسب لكل حالة
  status_text := CASE NEW.delivery_status
    WHEN '1' THEN 'استلام من التاجر'
    WHEN '2' THEN 'في الطريق للمحافظة'
    WHEN '3' THEN 'وصل للمحافظة'
    WHEN '4' THEN 'تم التسليم'
    WHEN '5' THEN 'لم يتم الرد'
    WHEN '6' THEN 'رقم خاطئ'
    WHEN '7' THEN 'عنوان خاطئ'
    WHEN '8' THEN 'مؤجل'
    WHEN '9' THEN 'ألغى العميل'
    WHEN '10' THEN 'لم يطلب'
    WHEN '11' THEN 'بدون رد + واتس'
    WHEN '12' THEN 'قيد المراجعة'
    WHEN '13' THEN 'مُحَوّل لشركة أخرى'
    WHEN '14' THEN 'تم إرسال واتس آب'
    WHEN '15' THEN 'رفض استلام'
    WHEN '16' THEN 'تضامن مع غزة'
    WHEN '17' THEN 'تم الإرجاع إلى التاجر'
    WHEN '18' THEN 'مكالمة'
    WHEN '19' THEN 'خطأ في العنوان'
    WHEN '20' THEN 'في المخزن'
    WHEN '21' THEN 'مُستلم جزئياً'
    ELSE 'حالة غير معروفة: ' || COALESCE(NEW.delivery_status, 'فارغ')
  END;

  -- تكوين رسالة الإشعار بالتنسيق المطلوب: "النص + رقم الطلب"
  notification_message := status_text || ' ' || COALESCE(NEW.order_number, NEW.id::text);

  -- التحقق من وجود إشعار مشابه لنفس الطلب والحالة
  SELECT id INTO existing_notification_id
  FROM notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND (data->>'delivery_status') = NEW.delivery_status
    AND created_at > now() - interval '1 hour';

  -- إنشاء إشعار جديد فقط إذا لم يوجد مشابه
  IF existing_notification_id IS NULL THEN
    INSERT INTO notifications (
      type,
      title,
      message,
      user_id,
      data,
      priority
    ) VALUES (
      'alwaseet_status_change',
      'تحديث حالة الطلب',
      notification_message,
      NEW.created_by, -- للموظف الذي أنشأ الطلب
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'delivery_status', NEW.delivery_status,
        'status_text', status_text,
        'delivery_partner', NEW.delivery_partner
      ),
      'medium'
    );

    -- إشعار إضافي للمديرين إذا كان الطلب من موظف
    IF NEW.created_by != '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      INSERT INTO notifications (
        type,
        title, 
        message,
        user_id,
        data,
        priority
      ) VALUES (
        'alwaseet_status_change',
        'تحديث حالة الطلب',
        notification_message,
        NULL, -- للمديرين
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'delivery_status', NEW.delivery_status,
          'status_text', status_text,
          'delivery_partner', NEW.delivery_partner,
          'employee_id', NEW.created_by
        ),
        'medium'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- إعادة ربط trigger
DROP TRIGGER IF EXISTS trigger_notify_alwaseet_status_change ON orders;
CREATE TRIGGER trigger_notify_alwaseet_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_alwaseet_status_change();

-- إنشاء index لتسريع البحث وتجنب التكرار
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_order_status_per_type 
ON notifications (type, (data->>'order_id'), (data->>'delivery_status'))
WHERE type = 'alwaseet_status_change' AND created_at > now() - interval '1 hour';

COMMENT ON FUNCTION notify_alwaseet_status_change() IS 'إنشاء إشعارات دقيقة لتغييرات حالة طلبات الوسيط - بدون تكرار';