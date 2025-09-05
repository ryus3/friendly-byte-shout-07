-- إضافة trigger لإشعارات طلبات جديدة محسنة
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  employee_name text;
  notification_title text;
  notification_message text;
  tracking_display text;
BEGIN
  -- الحصول على اسم الموظف
  SELECT COALESCE(p.full_name, p.username, 'موظف غير معروف') INTO employee_name
  FROM profiles p
  WHERE p.user_id = NEW.created_by;

  -- استخدام tracking_number بدلاً من order_number
  tracking_display := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

  -- صيغة الرسالة المحسنة
  notification_message := 'طلب جديد برقم تتبع ' || tracking_display || ' بواسطة ' || employee_name;
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 2)), ''),
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 1)), ''),
      'غير محدد'
    );

  -- إشعار للمديرين فقط (user_id = null)
  INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
  VALUES (
    'order_created',
    notification_title,
    notification_message,
    NULL, -- للمديرين
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'tracking_number', NEW.tracking_number,
      'employee_id', NEW.created_by,
      'employee_name', employee_name,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'final_amount', NEW.final_amount
    ),
    'high',
    false
  );

  RETURN NEW;
END;
$function$;

-- إنشاء أو تحديث trigger للطلبات الجديدة
DROP TRIGGER IF EXISTS notify_new_order_trigger ON public.orders;
CREATE TRIGGER notify_new_order_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();