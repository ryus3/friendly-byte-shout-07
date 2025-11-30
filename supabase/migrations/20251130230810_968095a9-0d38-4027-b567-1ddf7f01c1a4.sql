-- ============================================================================
-- CRITICAL: إنشاء Trigger الإشعارات مع الأعمدة الصحيحة
-- ============================================================================

-- المرحلة 1: إصلاح دالة send_order_notifications باستخدام الأعمدة الصحيحة
CREATE OR REPLACE FUNCTION public.send_order_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  employee_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- فقط عند تحديث الحالة
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR 
    OLD.delivery_status IS DISTINCT FROM NEW.delivery_status
  ) THEN
    
    -- الحصول على اسم الموظف
    SELECT COALESCE(full_name, email) INTO employee_name
    FROM profiles
    WHERE user_id = NEW.created_by;
    
    notification_title := 'تحديث حالة طلب';
    notification_message := 'طلب #' || NEW.tracking_number || ' - ' || COALESCE(NEW.customer_name, 'عميل');
    
    -- إرسال إشعار للمديرين والإدارة
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      related_entity_id,
      data,
      created_at
    )
    SELECT 
      p.user_id,
      'order_status_update',
      notification_title,
      notification_message,
      NEW.id::text,
      jsonb_build_object(
        'reference_type', 'order',
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_delivery_status', OLD.delivery_status,
        'new_delivery_status', NEW.delivery_status,
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'customer_name', NEW.customer_name,
        'employee_name', employee_name
      ),
      NOW()
    FROM profiles p
    WHERE p.role IN ('admin', 'manager');

    -- إرسال إشعار لمنشئ الطلب
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_entity_id,
        data,
        created_at
      ) VALUES (
        NEW.created_by,
        'my_order_status_update',
        'تحديث حالة طلبك',
        'طلب #' || NEW.tracking_number,
        NEW.id::text,
        jsonb_build_object(
          'reference_type', 'order',
          'old_status', OLD.status,
          'new_status', NEW.status,
          'old_delivery_status', OLD.delivery_status,
          'new_delivery_status', NEW.delivery_status,
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'customer_name', NEW.customer_name
        ),
        NOW()
      );
    END IF;
    
    -- تسجيل التغيير في order_status_history
    INSERT INTO order_status_history (
      order_id,
      status,
      delivery_status,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.status,
      NEW.delivery_status,
      NOW(),
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- المرحلة 2: إعادة إنشاء Trigger بشكل صحيح
DROP TRIGGER IF EXISTS trg_send_order_notifications ON orders;

CREATE TRIGGER trg_send_order_notifications
  AFTER UPDATE OF status, delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_notifications();

-- COMMENT للتوثيق
COMMENT ON TRIGGER trg_send_order_notifications ON orders IS 
'CRITICAL: Trigger تلقائي لإرسال إشعارات عند تغيير حالة الطلب. يُخزن الحالات القديمة والجديدة في data jsonb';