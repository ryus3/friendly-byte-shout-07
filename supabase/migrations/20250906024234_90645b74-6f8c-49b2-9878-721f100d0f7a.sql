-- إنشاء دالة مساعدة لتوليد إشعارات حذف الطلبات
CREATE OR REPLACE FUNCTION public.create_order_deletion_notification(
  p_order_id UUID,
  p_tracking_number TEXT DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tracking_display text;
  notification_message text;
BEGIN
  -- تحديد رقم التتبع المعروض
  tracking_display := COALESCE(
    NULLIF(p_tracking_number, ''), 
    NULLIF(p_order_number, ''), 
    p_order_id::text
  );
  
  -- تكوين رسالة الإشعار
  notification_message := tracking_display || ' تم حذف الطلب وتحرير المخزون المحجوز';
  
  -- إشعار لصاحب الطلب
  IF p_employee_id IS NOT NULL THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
    VALUES (
      'order_deleted',
      'حذف طلب',
      notification_message,
      p_employee_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'order_number', p_order_number,
        'tracking_number', p_tracking_number,
        'reason', 'deleted_from_delivery_partner'
      ),
      'medium',
      false
    );
  END IF;
  
  -- إشعار للمديرين
  INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
  VALUES (
    'order_deleted',
    'حذف طلب',
    notification_message,
    NULL, -- للمديرين
    jsonb_build_object(
      'order_id', p_order_id,
      'order_number', p_order_number,
      'tracking_number', p_tracking_number,
      'employee_id', p_employee_id,
      'reason', 'deleted_from_delivery_partner'
    ),
    'medium',
    false
  );
END;
$function$;