-- إصلاح فوري: إزالة إشعارات المدراء التي تسببت في الخطأ
-- الخطأ: column "role" does not exist - لأن roles مخزنة في جدول منفصل

CREATE OR REPLACE FUNCTION send_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking_number TEXT;
  v_old_status_text TEXT;
  v_new_status_text TEXT;
  v_notification_title TEXT;
BEGIN
  -- الحصول على رقم التتبع
  v_tracking_number := COALESCE(NEW.tracking_number, 'غير متوفر');
  
  -- استخدام الدالة الصحيحة الموجودة
  v_old_status_text := get_delivery_status_text(COALESCE(OLD.delivery_status, ''));
  v_new_status_text := get_delivery_status_text(COALESCE(NEW.delivery_status, ''));
  
  -- بناء عنوان الإشعار مع المدينة والمنطقة
  v_notification_title := COALESCE(NEW.customer_city, 'غير محدد') || ' - ' || COALESCE(NEW.customer_province, 'غير محدد');
  
  -- إرسال إشعار عند تغيير حالة التوصيل
  IF (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    -- إشعار للموظف صاحب الطلب فقط (بدون المدراء مؤقتاً)
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      related_entity_id,
      is_read,
      created_at,
      updated_at
    )
    VALUES (
      NEW.created_by,
      'order_status_changed',
      v_notification_title,
      v_new_status_text || ' - ' || v_tracking_number,
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', v_tracking_number,
        'old_status', OLD.delivery_status,
        'new_status', NEW.delivery_status,
        'old_status_text', v_old_status_text,
        'new_status_text', v_new_status_text,
        'customer_city', COALESCE(NEW.customer_city, ''),
        'customer_province', COALESCE(NEW.customer_province, '')
      ),
      NEW.id,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (related_entity_id, user_id, type) 
    WHERE type = 'order_status_changed'
    DO UPDATE SET 
      message = EXCLUDED.message, 
      title = EXCLUDED.title,
      data = EXCLUDED.data, 
      is_read = false,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;