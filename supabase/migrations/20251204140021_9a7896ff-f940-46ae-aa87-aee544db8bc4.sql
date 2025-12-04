-- إصلاح دالة send_order_notifications لإضافة customer_city و customer_province للإشعارات
CREATE OR REPLACE FUNCTION public.send_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status_text TEXT;
  v_new_status_text TEXT;
  v_tracking_number TEXT;
  v_admin_user_id UUID;
  v_employee_id UUID;
  v_admin_cursor CURSOR FOR 
    SELECT user_id FROM profiles WHERE role = 'admin' AND user_id != NEW.created_by;
BEGIN
  -- Only proceed if delivery_status actually changed
  IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
    
    -- Get tracking number
    v_tracking_number := COALESCE(NEW.tracking_number, NEW.order_number, 'غير محدد');
    
    -- Get old status text
    SELECT status_ar INTO v_old_status_text 
    FROM alwaseet_status_definitions 
    WHERE status_code = OLD.delivery_status::text
    LIMIT 1;
    v_old_status_text := COALESCE(v_old_status_text, 'غير معروف');
    
    -- Get new status text
    SELECT status_ar INTO v_new_status_text 
    FROM alwaseet_status_definitions 
    WHERE status_code = NEW.delivery_status::text
    LIMIT 1;
    v_new_status_text := COALESCE(v_new_status_text, 'غير معروف');
    
    v_employee_id := NEW.created_by;
    
    -- Notify all admins about employee's order status change
    OPEN v_admin_cursor;
    LOOP
      FETCH v_admin_cursor INTO v_admin_user_id;
      EXIT WHEN NOT FOUND;
      
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        v_admin_user_id,
        'order_status_changed',
        COALESCE(NEW.customer_city, 'غير محدد') || ' - ' || COALESCE(NEW.customer_province, 'غير محدد'),
        'طلب ' || v_tracking_number || ': ' || v_old_status_text || ' ← ' || v_new_status_text,
        jsonb_build_object(
          'order_id', NEW.id,
          'tracking_number', v_tracking_number,
          'old_status', OLD.delivery_status,
          'new_status', NEW.delivery_status,
          'old_status_text', v_old_status_text,
          'new_status_text', v_new_status_text,
          'employee_id', v_employee_id,
          'customer_city', COALESCE(NEW.customer_city, ''),
          'customer_province', COALESCE(NEW.customer_province, '')
        )
      );
    END LOOP;
    CLOSE v_admin_cursor;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- التأكد من وجود الـ trigger
DROP TRIGGER IF EXISTS trg_send_order_notifications ON orders;
CREATE TRIGGER trg_send_order_notifications
  AFTER UPDATE OF status, delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_notifications();