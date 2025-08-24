-- إصلاح تريغر إشعارات الطلبات لإرسال إشعارات صحيحة عن تغيير حالة التوصيل
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  status_text TEXT;
  notification_title TEXT;
  notification_message TEXT;
  existing_notification_id UUID;
BEGIN
  -- فقط عند تغيير delivery_status
  IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
    
    -- التحقق من عدم وجود إشعار مماثل في آخر 5 دقائق
    SELECT id INTO existing_notification_id
    FROM notifications 
    WHERE type = 'order_status_changed'
    AND (data->>'order_id')::uuid = NEW.id
    AND (data->>'new_status') = NEW.delivery_status
    AND created_at > now() - interval '5 minutes'
    LIMIT 1;
    
    -- إذا وجد إشعار مماثل، لا تنشئ جديد
    IF existing_notification_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- تحديد النص العربي لحالة التوصيل
    status_text := CASE NEW.delivery_status
      WHEN 'delivered' THEN 'تم التسليم'
      WHEN 'in_transit' THEN 'قيد التوصيل'
      WHEN 'pending' THEN 'في الانتظار'
      WHEN 'processing' THEN 'قيد المعالجة'
      WHEN 'shipped' THEN 'تم الشحن'
      WHEN 'out_for_delivery' THEN 'خرج للتوصيل'
      WHEN 'failed_delivery' THEN 'فشل التوصيل'
      WHEN 'returned' THEN 'تم الإرجاع'
      WHEN 'canceled' THEN 'تم الإلغاء'
      WHEN 'rejected' THEN 'تم الرفض'
      WHEN 'delayed' THEN 'متأخر'
      ELSE NEW.delivery_status
    END;
    
    notification_title := 'تحديث حالة الطلب ' || NEW.order_number;
    notification_message := 'تم تحديث حالة الطلب إلى: ' || status_text;
    
    -- إضافة رقم التتبع إذا كان متاحاً
    IF NEW.tracking_number IS NOT NULL AND NEW.tracking_number != '' THEN
      notification_message := notification_message || ' (رقم التتبع: ' || NEW.tracking_number || ')';
    END IF;
    
    -- إنشاء الإشعار
    INSERT INTO notifications (
      title,
      message,
      type,
      priority,
      data,
      user_id
    ) VALUES (
      notification_title,
      notification_message,
      'order_status_changed',
      CASE NEW.delivery_status
        WHEN 'delivered' THEN 'high'
        WHEN 'failed_delivery' THEN 'high'
        WHEN 'returned' THEN 'high'
        WHEN 'canceled' THEN 'medium'
        WHEN 'rejected' THEN 'medium'
        ELSE 'low'
      END,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'old_status', OLD.delivery_status,
        'new_status', NEW.delivery_status,
        'status_text', status_text,
        'tracking_number', NEW.tracking_number,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total_amount
      ),
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;